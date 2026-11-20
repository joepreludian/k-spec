# k-spec

## Purpose

k-spec is a Trello-style kanban board where a person hands work to AI agents as cards and talks to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth (a comment sent with "Send to agent" is a request, which a watching agent is told about), and an agent status tag shows whether an agent is idle, working, waiting for input, or blocked. The application owns its state: the board is stored in a SQLite database, people change it through the web UI (behind a token-link access gate), agents (and people in a terminal) through the `k-spec` CLI, and an MCP server comes next; nobody edits state by hand. Every edit in the browser is a command posted to the server and saved. What goes into git is a JSON dump of the board that the application writes and reads (`data/k-spec.dump.json`), never the database file. Cards carry sequential `#n` numbers, the card dialog has Overview / Spec / Execution / Activity tabs (Spec renders linked markdown files from the project; Execution shows where a card is being worked and the Claude session behind it, seeded for now), and the top bar names the project with links and a README sheet. A card's active work can also carry published services (title + URL, set through the `publishService` / `unpublishService` commands, seeded for now): the board card shows a globe that turns green when the browser's live check (`src/ui/shared/use-service-status.js`, a `no-cors` fetch) gets an answer, and the Overview tab lists them as new-tab buttons.

k-spec ships as one Docker image (server, CLI and skill). A project gets its own board by running `k-spec init` from that image: one container per project, a launcher file as that project's `k-spec` command, a port of its own (see "Distribution"). This repository's own board is not run that way: it keeps `npm run dev`.

## Stack

Node 24, npm, Next.js 16 (App Router, JavaScript), React 19, Tailwind CSS 4, shadcn/ui (JSX mode), dnd-kit, react-markdown, SQLite through Drizzle ORM (`drizzle-orm` + `better-sqlite3`, migrations by `drizzle-kit`), Vitest + Testing Library + jsdom, lucide-react, sonner.

## Layout

```
src/
  domain/          pure JS, no React, no Next. Entities as plain objects,
                   pure functions returning new objects, domain errors.
  application/     use cases over the BoardRepository port; the command
                   registry (name -> use case); board-lookup.js (card by
                   number, lane by name, item by c.i, service by title).
  infrastructure/  in-memory repository (tests), seed board, clock, ids, local
                   and HTTP command executors, access-token logic.
    store/         the SQLite store: schema, repository, dump/load, the
                   per-process server store and command queue.
    server-note.js the note a running server leaves for the CLI.
    starter-board.js  the empty first board of a project (K_SPEC_BOARD_NAME).
    port-check.js  whether a port is free on this machine (used by init).
  cli/             the k-spec command: main.js (entry, exit codes), command
                   tables (read-commands.js, write-commands.js), render.js
                   (text output), connection.js (where the server is), watch.js
                   (the command that waits and prints open requests).
    init/          `k-spec init`: init-command.js (the command), project-files.js
                   (compose file, settings, ignore file, skill copy, as text),
                   launcher.js (the project's launcher, a sh script, as text),
                   choose-port.js (a free port from the default range).
  ui/              React components, the board context store (useBoard).
  components/ui/   shadcn-generated primitives.
  app/             Next.js App Router entry; wires everything together.
    api/board/             GET /api/board: { board, version } from the store
    api/board/version/     GET /api/board/version: { version }, polled by the browser every 10 s
    api/commands/[name]/   POST /api/commands/<name>: run one command, answer { ...result, version }
    api/files/[...path]/   GET /api/files/<path>: read-only markdown from the project dir
    files/[...path]/       /files/<path>: full-page view of one markdown file
  proxy.js         Next 16 request proxy (middleware) for the token gate.
bin/               k-spec.mjs: the executable; gives src/cli/main.js the real world.
skills/k-spec/     the skill that tells a Claude Code session how to use the board (the copy that
                   ships). .claude/skills/k-spec is a link to it, so sessions in this repo load it.
scripts/           db-dump.mjs, db-load.mjs and the `@/` alias hook for plain node;
                   smoke.sh, the end-to-end test of the image.
Dockerfile         the image: production server by default, `k-spec` on the PATH.
.github/workflows/ ci.yml (lint, test, build, image + smoke) and release.yml (publish on a version tag).
drizzle/           generated SQL migrations, committed (never edit by hand).
data/              k-spec.dump.json (committed); the SQLite file and the running
                   server's note k-spec.server.json (both git-ignored).
```

Dependency rule: `ui -> application -> domain`. `infrastructure` implements ports and is injected at the edge (`src/app`). Nothing in `domain` or `application` imports from `ui`, `cli`, `infrastructure`, `react`, or `next`. `cli` is an edge like `ui`: `cli -> application -> domain`, with `infrastructure` imported only by `src/cli/main.js` and `bin/k-spec.mjs`.

## Rules

- **TDD is mandatory.** Write the failing test first, watch it fail, write the minimal code, watch it pass, refactor. No production code without a failing test.
- **Domain is pure JavaScript.** No framework imports, no side effects, immutable updates, ISO-8601 string timestamps. Everything must serialize to plain JSON.
- **UI only dispatches commands.** Components call `dispatch(commandName, input)` with a plain serializable input; they never touch repositories or domain mutation functions directly.
- **JavaScript only.** `.js` / `.jsx`, ESM. No TypeScript files.
- **Plain React context** for state. No Zustand or other state libraries.
- **Domain-driven design.** New behaviour starts in `domain/`, is exposed as a use case in `application/`, registered in the command registry, then used by the UI.

## Commands

```bash
npm run dev          # start the dev server (prints the access link)
npm test             # run the whole test suite once (vitest run)
npm run test:watch   # vitest in watch mode
npm run lint         # eslint (next config)
npm run build        # production build
K_SPEC_TOKEN=mytoken npm run dev   # fix the access token instead of a generated one
K_SPEC_HOST=my-host npm run dev    # host name used in the printed access link; also allow-listed for dev HMR
K_SPEC_PROJECT_DIR=/path npm run dev   # directory the markdown viewer reads from (default: cwd)
K_SPEC_DB=/path/k.db npm run dev        # SQLite file (default: ./data/k-spec.db, git-ignored)
K_SPEC_DUMP=/path/k.json npm run dev    # dump file (default: ./data/k-spec.dump.json, committed)
npm run db:dump      # write the stored board to the dump file
npm run db:load      # replace the stored board with the dump file (safe while the server runs)
npm run db:generate  # after changing src/infrastructure/store/schema.js: generate a migration into drizzle/
npx k-spec help      # the CLI (needs the server running); `npm link` makes `k-spec` global
K_SPEC_URL=http://host:3000 K_SPEC_TOKEN=… k-spec board   # the CLI from outside the project folder
K_SPEC_AGENT=Claude k-spec comment 4 "done"                # comment as an agent (same as --agent Claude)
k-spec comment 4 "plan this" --request                     # a request to the agent (the browser's "Send to agent")
k-spec watch                                               # print open requests, one line each, until stopped
K_SPEC_SERVER_FILE=/path/note.json npm run dev            # where the server leaves its note (default ./data/k-spec.server.json)
K_SPEC_NOTE_URL=http://k-spec:14201 npm run dev           # the address written into that note (default http://localhost:<PORT>)
K_SPEC_BOARD_NAME="My App" npm run dev                    # a database with no board and no dump starts as an empty board of that name
K_SPEC_BRANCH=feat/x K_SPEC_HOSTNAME=mac k-spec start 4   # what `start` records instead of asking git and the machine (a launcher sets them)
K_SPEC_START_HINT="…" k-spec board                        # how to start the server, for the "server not running" line (a launcher sets it)
docker build --build-arg K_SPEC_IMAGE=k-spec:dev -t k-spec:dev .   # the image; it must be told its own name
sh scripts/smoke.sh k-spec:dev                            # set a scratch project up from the image and drive its board
K_SPEC_IMAGE=k-spec:dev npx k-spec init                   # `init` from source (in a scratch folder, not in this repository)
```

The server prints `k-spec board: http://<host>:<port>/?token=…` on start. Opening that link sets the access cookie; without it every page redirects to `/access`. The cookie is named for the port the browser used (`k-spec-token-<port>`, from the Host header), because browsers keep cookies per host name and not per port: with one fixed name, two boards on one machine would sign each other out. The plain `k-spec-token` is still accepted (the CLI sends it; older browsers hold it) and is what gets set when the host has no port. The gate lives in `src/proxy.js` and `src/infrastructure/access/`; `accessCookieNames(host)` is the one place that knows the names.

When the browser reaches the dev server through any host other than `localhost` (a LAN name, a Lima/VM host name), set `K_SPEC_HOST` to that host. `next.config.mjs` passes it to `allowedDevOrigins`; otherwise Next rejects the hot-reload websocket and the Turbopack dev client never hydrates, so the board renders but nothing responds to clicks. Plain-http pages on such hosts are not secure contexts, so ids come from `createIdGenerator` (`src/infrastructure/id-generator.js`), which falls back to `getRandomValues` when `crypto.randomUUID` is missing.

The file viewer (`/api/files/<path>`, `/files/<path>`, the README sheet, the card Spec tab) serves only `.md`/`.markdown` files inside `K_SPEC_PROJECT_DIR`, capped at 1 MiB, behind the same token; the path rule is `src/domain/markdown-path.js` and the resolver is `src/infrastructure/files/`.

## Store

The board lives in SQLite (`src/infrastructure/store/`). `schema.js` has the tables: anything the domain gives an id is a row keyed by that id, ordered children carry a `position`, and value objects without identity (a work's location and session, an event's type-specific fields) are JSON columns. `sqlite-board-repository.js` implements the same `BoardRepository` port the use cases always had: `load()` assembles the whole board, `save(board)` replaces every row in one transaction and adds 1 to the board's `version`. Use cases and the domain know nothing about SQL.

The server is the only writer. `server-store.js` holds one connection and one command queue per process (on `globalThis`, so dev hot reload reuses them). `POST /api/commands/<name>` takes the command's input as a JSON object and runs it through the queue, one command at a time, so two requests never load the same board and overwrite each other. Answers: `200 { ...result, version }`, `422 { error, code }` for a broken domain rule, `404` unknown command, `400` body not a JSON object, `415` not sent as JSON, `500` anything else. In the browser, `http-command-executor.js` posts commands and `useRemoteBoard` decides which board is newest (a command's answer, or a reload after the 10 s version check shows someone else changed it).

Dump and load: `data/k-spec.dump.json` is `{ "format": 1, "board": … }` with sorted keys. It is written on demand (`npm run db:dump`) and when the server shuts down, not after every command. A database that holds no board is filled from the dump if there is one; otherwise with an empty board named `K_SPEC_BOARD_NAME` when that is set (`starter-board.js`: the five standard lanes, nothing else), else with the sample board (`seed-board.js`); a database that already has a board never reads the dump, so after pulling a newer dump run `npm run db:load`. Stopping the server overwrites the dump with the server's state. A dump that cannot be read stops startup with the file named.

**`data/k-spec.dump.json` is written by the application. Do not edit it by hand or with an agent.** Change the board through the app, then run `npm run db:dump`.

## CLI

`k-spec` (`bin/k-spec.mjs` → `src/cli/main.js`) is a thin client of the running server; it never opens the database or the dump. It reads the whole board from `GET /api/board`, turns what was typed (a card `#n`, a lane name, an item `c.i`, a service title) into ids with `src/application/board-lookup.js`, prints with the pure functions in `src/cli/render.js`, and posts to `POST /api/commands/<name>`. A command is one entry `{ usage, summary, options, arity, run }` in `read-commands.js` or `write-commands.js`; the help text is generated from those tables. `runCli` takes its whole world as arguments (argv, env, fetch, stdin, stdout, …) and returns the exit code, so tests run it against the fake server in `src/test/board-server.js` without a process.

Commands: `board`, `show`, `watch`, `comment`, `status`, `move`, `check`, `uncheck`, `add`, `delete`, `start`, `end`, `link`, `publish`, `unpublish`, `run <command> <json>` for everything else, and `init`, which talks to no server (see "Distribution"). `start` takes the branch and host name from `K_SPEC_BRANCH` / `K_SPEC_HOSTNAME` when they are set. Output is compact plain text (no colour, no ids; `--json` for the machine form). Text that comes from the board goes through `oneLine` (one-line fields, confirmations, error lines) or is indented under its heading (descriptions, comments) in `render.js`, so a card's content cannot forge CLI output or drive the terminal; keep that when adding output. A comment is the person's unless `--agent <name>` or `K_SPEC_AGENT` says an agent wrote it. Failures are one `error: …` line on stderr; exit `1` refused, `2` usage, `3` no connection.

Connection: `K_SPEC_URL` with `K_SPEC_TOKEN` when `K_SPEC_URL` is set; otherwise the note the server writes on start and removes on exit (`data/k-spec.server.json`: `{ url: "http://localhost:<port>", token, pid }`, mode 600, git-ignored). `K_SPEC_TOKEN` alone is ignored by the CLI because it is also the server's "fix the token" variable. The token is sent as the plain `k-spec-token` cookie. When there is no note, the message says how to start the server: `npm run dev` by default, or `K_SPEC_START_HINT`.

## Requests to the agent

A request is a comment a person addressed to the agent: `addComment` with `request: true` (the "Send to agent" button, or `k-spec comment <n> … --request`). Only a request carries the `request` key; an ordinary comment has none, so boards and dumps from before requests are unchanged byte for byte. Only a person can send one. Whether a request is **open** is never stored: it is open while no agent comment comes after it on that card (`openRequests(card)` in `src/domain/card.js`, `boardOpenRequests(board)` in `src/domain/board.js`). The browser, `show`, `board` and `watch` all ask those two functions; do not add a second definition or a stored flag.

`k-spec watch` (`src/cli/watch.js`) is the one command that waits. It is `lazy`: `runCli` gives it `ctx.connect()` instead of a ready `ctx.api`, plus `ctx.sleep` and `ctx.signal`, so it can outlive a server restart and be driven step by step in tests (`steps` in `src/cli/test-cli.js`). Every 2 s it reads `GET /api/board/version` and reads the board only when that changed or after an outage. It prints a request once per run, on one line: every field goes through `flat` (control characters and all white space collapsed), because the reader is Claude Code's Monitor, which treats each stdout line as an event. Connection reports (`k-spec: …`) also go to stdout for that reason, once per kind of trouble (away, token rejected, unexpected answer), so a server that comes back refusing the token is not mistaken for one still away. The server has no push channel and no event log; open requests are always derivable from the board, which is what makes restarts and gaps safe.

The skill in `skills/k-spec/SKILL.md` is the agent's side of the contract (read the card, set `working`, reply once, set `waiting` or `idle`; never acknowledge with a comment, since the first agent comment answers the request). `src/cli/skill.test.js` fails if it names a command or option the CLI does not have. Edit the skill there only: `.claude/skills/k-spec` is a relative link to that folder (the same test checks it), never a second copy.

## Distribution

The image (`Dockerfile`) holds the production server (default command, `next start`), the CLI (`k-spec` on the PATH) and the skill. In it the board's files are in `/data` (`K_SPEC_DB`, `K_SPEC_DUMP`, `K_SPEC_SERVER_FILE` are preset) and the project is mounted read-only at `/project` (`K_SPEC_PROJECT_DIR`). It is published as `docker.io/joepreludian/k-spec` by `.github/workflows/release.yml` when a tag `v<version>` matching `package.json` is pushed; that file is the only place in the source that names the registry.

`k-spec init` (`src/cli/init/`) sets the current folder up as a project and, run again, brings it to the image it runs from. It writes `.k-spec/compose.yaml`, `.k-spec/k-spec` (the launcher), `.k-spec/.gitignore`, `.k-spec/.env` (mode 600) and `.claude/skills/k-spec/SKILL.md`, and makes `.k-spec/data/`. It gets the machine through `local` (`runCli`'s world: write a file, make a folder, the user's ids, random bytes, "is this port free"), given by `bin/k-spec.mjs`; tests give an in-memory one. Everything is decided and checked before the first write.

Rules that are easy to break:

- **The image knows its own name.** The build argument `K_SPEC_IMAGE` becomes the environment variable, and `init` writes exactly that into the compose file and the launcher. Nothing else in the source names an image. Without the variable `init` refuses.
- **Generated files are rewritten, settings are kept.** Compose file, launcher, ignore file and skill copy are rendered from scratch on every run. `.env` keeps every line: only a missing key is added, only a key whose option was passed is changed. The project's id, name and slug are read back from the first line of the compose file (`# k-spec-project: {…}`). That line can come from someone else's repository and ends up in a shell script and in YAML, so `readComposeHeader` takes an id and a slug only in the form init generates (16 hex characters; `[a-z0-9-]`, at most 40), and `init` refuses a compose file that is there without a valid header instead of overwriting it. `.env` is read the way Compose reads it (`export`, quotes, a comment after the value), so init and the board never disagree about what it says.
- **`.env` keys are not names the server or the CLI read** (`K_SPEC_BOARD_TOKEN`, not `K_SPEC_TOKEN`): Compose prefers a variable exported in the shell over the file. The compose file maps them to the real names.
- **The port** comes from `choosePort`: the range 14201 to 14299 in random order, the first that `portIsFree` accepts. A `--port` given by hand is checked too. A port already in `.env` is never checked again (the project's own board holds it). The check only sees the machine's ports when `init` runs with `--network host`.
- **Docker names carry the slug, not the folder**: container and network are `k-spec-<slug>`, the compose project name is unique per set-up (in `.env`). So a second project with the same name fails to start instead of replacing the first one's board, and the launcher refuses a board whose `k-spec.project` label is not its own id.
- **The launcher** (`launcher.js`) is POSIX sh: `exec docker run --rm --init -i`, joined to the board's network and volumes, as the caller's uid, no terminal. It passes its arguments untouched and never passes `K_SPEC_URL` or `K_SPEC_TOKEN`. Its test runs it against stand-ins for `docker` and `git`.
- **Any uid.** The container runs as whoever owns the project and writes only `/data` and `/tmp`. Nothing in the server or the CLI may need a home directory or an entry in the user database.
- **Install scripts are off** (`npm ci --ignore-scripts`) in the image and in CI: no dependency needs one, and with them npm tries to compile better-sqlite3, which ships its binaries.
- **The dump must stay committable.** `.k-spec/.gitignore` starts with `!data/` and `!data/k-spec.dump.json`: a project's own `.gitignore` often ignores every folder called `data`, which would take the board out of git unnoticed.
- **The image's test is `scripts/smoke.sh`**, run by CI. Change the Dockerfile, the compose template or the launcher only with it green; add a check there for behaviour that only exists in a container.

## Git

- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`).
- Never push. The user pushes.
- No `Co-Authored-By` trailers.
- `docs/specs/` is not committed.

## Specs

Design documents and implementation plans live in `docs/specs/` (git-ignored). Read the current design and plan there before changing the project.
