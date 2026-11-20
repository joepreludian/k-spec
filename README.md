# k-spec

A Trello-style kanban board built for working with AI agents. You hand work to agents as cards and talk to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag (idle, working, waiting for input, blocked) shows where each card stands. The board's state lives in a SQLite database owned by the application. You change it in the web UI; the `k-spec` command line gives an agent (or you, in a terminal) the same board; an MCP server comes next.

**Current slice:** k-spec ships as a Docker image, one board per project, set up with `k-spec init` (see "Install in a project"). Inside it: the web UI and the `k-spec` command line on a SQLite store, behind a token-link access gate. Cards have sequential `#n` numbers; tiles show labels, where a card is being worked (lima instance, worktree or host, plus the branch), an animated status dot for cards waiting for input or blocked, and one progress segment per checklist. Opening a card shows four tabs: Overview (execution summary, description, checklists), Spec (linked markdown files rendered in place), Execution (location, branch, Claude session, tokens, history) and Activity (comments and status changes). The top bar names the project, carries its links, and opens the README in a side sheet. Every edit is saved on the server. Execution data in the sample board is seeded; the CLI's `start`, `end` and `publish` write it for real.

## Install in a project

k-spec runs as one Docker container per project. Each project gets its own board, its own port and its own `k-spec` command, and nothing is installed on the machine besides the image. You need Docker with Compose (Docker Engine on Linux, or Docker Desktop).

In the project's folder:

```bash
docker run --rm --network host -u "$(id -u):$(id -g)" -v "$PWD:$PWD" -w "$PWD" \
  docker.io/joepreludian/k-spec:latest k-spec init
docker compose -f .k-spec/compose.yaml up -d --wait
docker compose -f .k-spec/compose.yaml logs k-spec
```

The first command sets the project up, the second starts its board, the third shows the access link:

```
  k-spec board: http://localhost:14237/?token=…
```

Open the link once. It sets a cookie and you land on an empty board named after the folder, with the lanes Backlog, Todo, In Progress, Review and Done. The board keeps running in the background and comes back by itself after a reboot.

`init` wrote these files:

| File | What it is | Commit it? |
|---|---|---|
| `.k-spec/compose.yaml` | The board's container, pinned to the image version that set the project up | yes |
| `.k-spec/k-spec` | The launcher: the `k-spec` command for this project's board | yes |
| `.k-spec/.gitignore` | Keeps the three entries below marked "no" out of git | yes |
| `.claude/skills/k-spec/SKILL.md` | The skill that tells Claude Code how to use the board | yes |
| `.k-spec/data/k-spec.dump.json` | The board, as the application writes it (see "The board in git") | yes |
| `.k-spec/.env` | This machine's token, port, host name and owner | no |
| `.k-spec/data/k-spec.db*` | The database | no |
| `.k-spec/data/k-spec.server.json` | The running server's note for the launcher | no |

The generated files are rewritten each time `init` runs, so do not edit them; `.env` is where a machine's settings live.

**Using it.** You use the board in the browser. An agent, or you in a terminal, uses the launcher, from anywhere inside the project:

```bash
.k-spec/k-spec board
.k-spec/k-spec show 3 --activity
.k-spec/k-spec comment 3 "Looks good"
.k-spec/k-spec help
```

Every call runs once in a short-lived container next to the board (about a third of a second) and leaves nothing behind. The launcher reaches this project's board and no other. In Claude Code, open a session in the project and say "watch the board", or name a card ("let's refine k-spec #3"); the skill does the rest (see "Requests to the agent").

**Options of `init`.**

| Option | Meaning | Default |
|---|---|---|
| `--name <name>` | The project's name: the board's name, and (lower-cased, as `k-spec-<name>`) the name of its container | the folder's name |
| `--port <n>` | The port the board is published on | a free one between 14201 and 14299, picked at random |
| `--host <name>` | The host name in the printed access link, for a VM or LAN name | `localhost` |

**Several projects on one machine.** Run the same three commands in each project. Every `init` picks a port nobody is listening on, so the boards do not collide and can all be open in one browser.

- `--network host` in the first command is what lets `init` see which ports are in use. Without it the port is still picked at random from the range, but not checked.
- A stopped board does not hold its port, so a project set up later can be given the same one. Then the board that starts second fails with Docker's "port is already allocated". Run `init --port <n>` there (the full `docker run … k-spec init --port <n>`), and `up -d` again.
- Two projects whose folders have the same name cannot both run: the second fails to start with "container name is already in use" and the first is not touched. Give one of them a name: `init --name "Another name"`.
- A second clone or a git worktree of a project on the same machine uses the first one's board: the launcher is committed and finds the board by its name.
- On Docker Desktop, "the host's network" is that of Docker's own virtual machine. What the port check sees there has not been tried.

**Updating.** Run the first command again with the newer image, then `docker compose -f .k-spec/compose.yaml up -d`. The project keeps its token, port, name and board; the compose file, the launcher and the skill are brought to the new version. There is no way back to an older version.

**The board in git.** The database is not committed; a JSON dump of the board is. The server writes it when the board stops (`docker compose … stop`, `down`, a restart, a shutdown of the machine), not after every change, so write it yourself before committing the board:

```bash
docker compose -f .k-spec/compose.yaml exec k-spec npm run db:dump   # the board -> .k-spec/data/k-spec.dump.json
docker compose -f .k-spec/compose.yaml exec k-spec npm run db:load   # the dump -> the board, after pulling a newer one
```

On another machine, clone the project and run the same three commands: `init` keeps the project's name from the committed files and gives that machine its own token and port, and a board with an empty database starts from the committed dump. Do not edit the dump by hand.

**A board on another machine.** The launcher only talks to its own project's board. For any other board, give the address and token yourself:

```bash
docker run --rm -e K_SPEC_URL=http://that-host:14237 -e K_SPEC_TOKEN=… docker.io/joepreludian/k-spec:latest k-spec board
```

**Removing it.** `docker compose -f .k-spec/compose.yaml down`, then delete `.k-spec/` and `.claude/skills/k-spec/`.

**Good to know.**

- The board's port is open on the machine's network, over plain HTTP, and the token is the only gate. Whoever has the access link can write on the board, and with that instruct an agent that is watching it. `.k-spec/.env` holds the token; it is readable by you only and git-ignored.
- If the Docker client behind a launcher call is killed outright (`kill -9`), its container stays. `docker ps --filter label=k-spec.role=cli` lists such containers.
- `docker compose … down` while a `watch` is running reports the network as still in use. Stop the watch first, or use `stop`.
- In a git worktree, the card's Spec tab shows the files of the checkout the board was started from.
- `COMPOSE_PROJECT_NAME` exported in your shell overrides every project's own compose project name. Do not export it where you start boards.
- Rootless Docker and Podman are not supported, and Windows needs WSL. `init` refuses to run as root: the `-u "$(id -u):$(id -g)"` in the command is what makes the files yours.

## Developing k-spec

The rest of this file is about k-spec's own repository: running it from source, how it stores the board, the command line in detail, building and releasing the image.

```bash
npm install
npm run dev
```

The server prints an access link on start:

```
  k-spec board: http://localhost:3000/?token=…
```

Open that link once; it sets a cookie and you land on the board. Anyone hitting the board without the cookie is sent to `/access` and asked for the token. Without `K_SPEC_TOKEN` a new token is generated on every start, which invalidates the cookie in your browser. For daily use copy `.env.example` to `.env.local` and set `K_SPEC_TOKEN` to any random string; `.env.local` is git-ignored. `K_SPEC_HOST` changes the host shown in the link (useful over LAN, Tailscale, a VM host name, or a DNS name); in development it is also the host Next allows to connect for hot reload, and without it a board opened through that host never becomes interactive. `K_SPEC_PROJECT_DIR` points the file viewer at a project directory other than the current one.

## Where the board is stored

The board is saved in a SQLite file (`data/k-spec.db` by default, set `K_SPEC_DB` to move it). That file is git-ignored. What you commit is a dump the application writes: `data/k-spec.dump.json` (`K_SPEC_DUMP` to move it).

```bash
npm run db:dump   # write the current board to the dump file
npm run db:load   # replace the current board with the dump file
```

The dump is also written when the server stops. On start, a project with no SQLite file imports the dump (or starts from a sample board when there is no dump); a project that already has a SQLite file keeps it and does not read the dump, so run `npm run db:load` after pulling a newer one. Do not edit the dump by hand.

## Command line

`k-spec` shows the board in a terminal and changes it. It is what an AI agent uses instead of the browser, and it works just as well for a person. It talks to the running server, so what you drag in the browser is what `k-spec board` prints next, and what the CLI changes shows up in an open browser tab within about 10 seconds.

```bash
.k-spec/k-spec board      # in a project set up with `k-spec init`
npx k-spec board          # in k-spec's own repository
npm link                  # there, once, to have `k-spec` everywhere
```

The examples below write `k-spec`; in a project that is `.k-spec/k-spec`.

| Command | What it does |
|---|---|
| `k-spec board [--lane <name>] [--status <status>]` | Lanes in order, one line per card |
| `k-spec show <n> [--activity]` | One card in full |
| `k-spec watch` | Print every open request to the agent, one line each, and keep running |
| `k-spec comment <n> <text> [--agent <name>] [--request]` | Add a comment (`-` reads stdin); `--request` sends it to the agent |
| `k-spec status <n> <status>` | `idle`, `working`, `waiting` (short for `waiting-for-input`), `blocked` |
| `k-spec move <n> <lane> [--top]` | Move to the end of a lane, or its top |
| `k-spec check <n> <item>` / `uncheck` | Tick an item by the number `show` prints, e.g. `1.2` |
| `k-spec add <lane> <title> [--description <text>]` | Create a card; prints its number |
| `k-spec delete <n>` | Delete a card, without asking |
| `k-spec start <n> [--branch <b>] [--location <kind>:<name>] [--worktree <path>]` | Start work (default: current git branch, `host:<this machine>`) |
| `k-spec end <n>` | End the work |
| `k-spec link <n> <path> [<title>]` | Attach a markdown file of the project to the card (shown in its Spec tab) |
| `k-spec publish <n> <title> <url>` / `unpublish <n> <title>` | Services on the active work |
| `k-spec run <command> [<json>]` | Any other command, with raw ids (`k-spec show <n> --json` prints them) |
| `k-spec init [--name <name>] [--port <n>] [--host <name>]` | Set a folder up as a k-spec project; run from the image (see "Install in a project"), needs no server |

`<n>` is the card's number, with or without `#`. Lanes and services are named by their whole name, ignoring case. Add `--json` to any command for JSON instead of text. Text that starts with a dash goes after `--`: `k-spec comment 4 -- "-1 from me"`.

```
$ k-spec board
k-spec  v12
Backlog (2)
  #7 idle     Lane folder markdown mapping
  #8 blocked  Drag preview flickers on Firefox  [bug]  2 comments
In progress (1)
  #4 working  CLI argument parser  [cli, ui]  1/3 done  5 comments  work feat/cli

$ k-spec show 4
#4 CLI argument parser
lane In progress | status working | labels cli, ui | updated 2026-11-14 10:00

Description
  …

Checklist 1: Done when (1/3)
  1.1 [x] parses flags
  1.2 [ ] prints help
Comments (2)
  You, 2026-11-14 09:30: Start with the parser.
  Claude (agent), 2026-11-14 10:00: Parser done, help next.
```

**Text from cards.** Titles, names and other one-line fields are printed on one line with control characters replaced by spaces; descriptions and comments are indented under their heading. So nothing written on a card can pass for a line the CLI itself printed. `--json` gives the text untouched.

**Who wrote a comment.** A comment from the CLI is yours, like one typed in the browser. An agent marks its own with `--agent <name>`, or by having `K_SPEC_AGENT=<name>` in its environment.

**Finding the server.** A running server writes `data/k-spec.server.json` (its address and token, git-ignored, removed when it stops; `K_SPEC_SERVER_FILE` moves it). Run in the project folder, the CLI reads it and needs no setup. Anywhere else, set `K_SPEC_URL` and `K_SPEC_TOKEN`; a fixed `K_SPEC_TOKEN` on the server keeps that stable across restarts. A project's launcher needs none of this: it runs the CLI next to the board's container, where the note is, and passes no address or token from your shell.

**Failures** are one line on stderr starting with `error:`. Exit codes: `0` done, `1` refused (a rule, or a card, lane or item that does not exist), `2` wrong usage, `3` no connection (server not running, not answering, or the token was rejected).

## Requests to the agent

A comment is a note for people. A **request** is a comment addressed to the agent: write it in the card's comment box and press **Send to agent** instead of **Comment** (in a terminal: `k-spec comment <n> "…" --request`). A request is open until an agent comments on that card; the comment shows "waiting for agent" and then "answered", and a card with open requests carries a small count on the board. One agent comment answers every request above it on the card. There is no way to cancel a request yet.

`k-spec watch` is how an agent hears about them. It prints every open request when it starts and each new one within about 2 seconds, one line each, and nothing else:

```
$ k-spec watch
watching k-spec at http://localhost:3000, 1 open request
request #12 Refine the CLI [Backlog, idle] You, 2026-11-19 14:02: Let's plan this feature.
```

The line carries the first 200 characters; the agent reads the rest with `k-spec show 12 --activity`. A request is printed once per run, and again by the next run while it is still open, so nothing is lost when nobody was watching. If the server goes away the watch says so once (`k-spec: server not answering at …`), keeps trying, re-reads the server's note (a restarted server has a new token) and says `k-spec: connected to …` when it is back. If the trouble changes it says that too: `k-spec: token rejected by …` means the server is up but the token the watch has is no longer right, which happens when `K_SPEC_TOKEN` comes from the environment and the server was restarted without a fixed token. It stops on Ctrl-C. `--json` prints one JSON object per line instead.

**In Claude Code.** k-spec ships a skill, `skills/k-spec/SKILL.md`. `k-spec init` writes a copy into the project's `.claude/skills/k-spec/`, with a note that the command there is `.k-spec/k-spec`; in this repository the skill is linked into `.claude/skills`. With it, a session:

- reads the card when you name one in the chat ("let's refine k-spec #12"), with its history and linked files, so you do not have to paste context;
- watches the board when you ask it to ("watch the board"): it runs `k-spec watch` under Claude Code's Monitor tool, which delivers each printed line to the chat and wakes the session. A monitor lives 30 minutes at most, so the agent starts it again each time;
- handles a request: sets the card to `working`, does the work in the session, attaches files it wrote with `k-spec link`, replies once on the card, and sets `waiting` (you have to act) or `idle`.

To make a project's sessions watch from the start, say so in that project's `CLAUDE.md`.

**What the access link is worth.** Whoever can write on the board can now give instructions to an agent that is watching it. Share the token link as you would share access to that agent.

## Viewing project files

Cards can link markdown files from the project (`docs/specs/feature.md`), shown in the card's Spec tab, and the top bar opens the project README. Both read through `GET /api/files/<relative path>`, and `/files/<relative path>` shows a file full-page, so a file's address mirrors its place in the repo. The viewer serves only `.md`/`.markdown` files inside `K_SPEC_PROJECT_DIR` (default: the directory the server runs in), rejects anything with `..` or an absolute path, caps files at 1 MiB, and sits behind the same token gate. Relative links between markdown files keep working inside the viewer.

## Testing

```bash
npm test          # vitest, whole suite once
npm run test:watch
npm run lint
npm run build
```

Development is test-first: every domain rule, use case, and UI interaction has a test that was written before the code. The image has its own test, the smoke script (next section).

## Building the image yourself

```bash
docker build --build-arg K_SPEC_IMAGE=k-spec:dev -t k-spec:dev .
sh scripts/smoke.sh k-spec:dev
```

`K_SPEC_IMAGE` must be the name the image is tagged with: `init` writes it into the files of the projects it sets up, which is how a project stays on the version that set it up. The smoke script sets a scratch project up from the image, starts its board and drives it through the launcher (a card, a request, `watch`, a stop and start, the dump, a port in use, a second project with the same name), then removes everything. To try the image in a real project, use `k-spec:dev` in place of the published name in the `init` command. `K_SPEC_IMAGE=k-spec:dev npx k-spec init` runs `init` from source.

## Releasing

1. Set the new version: `npm version <x.y.z> --no-git-tag-version`, and commit.
2. Tag that commit `v<x.y.z>` and push the tag.

The Release workflow (`.github/workflows/release.yml`) fails if the tag is not the version in `package.json`, runs the same checks as every pull request (`.github/workflows/ci.yml`: lint, tests, build, then the image and its smoke script), and publishes `docker.io/joepreludian/k-spec` for amd64 and arm64 under three tags: `<x.y.z>`, `<x.y>` and `latest`. Nothing is published without a version tag. The repository needs two secrets, `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker Hub access token that may write).

## Layout

Domain-driven, in layers under `src/`: `domain` (pure data and rules), `application` (use cases and the command registry), `infrastructure` (SQLite store, seed, access token, HTTP client), `ui` (React components and the board context store), `cli` (the `k-spec` command; its executable is `bin/k-spec.mjs`; `cli/init/` holds `init` and the files it writes into a project), `app` (Next.js entry). At the root: the `Dockerfile`, `scripts/smoke.sh` (the image's test), `skills/k-spec/` (the skill) and `.github/workflows/`. See `CLAUDE.md` for the layer rules and conventions.

## Roadmap

1. **Board UI** with the token gate, ticket numbers, the tabbed card with linked spec files and execution details, and the project top bar. *(done)*
2. **SQLite store**: commands run on the server and are saved; JSON dump and load for git. *(done)*
3. **CLI**: `k-spec`, a client of the server, the agent's view of the board. *(done)*
4. **Requests to the agent**: "Send to agent" in the browser, `k-spec watch`, and the Claude skill. *(done)*
5. **Distribution**: one Docker image, a board per project set up with `k-spec init`, a launcher per project, CI and releases. *(this slice)*
6. **Working agreement on the board**: spec file, approval, the plan as checklists, review, driven through requests.
7. **MCP server**: the same commands as tools, so Claude manages cards without touching files.
8. **Card documents**: where a card's spec markdown lives and how agents attach it.
