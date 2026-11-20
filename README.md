# k-spec

A Trello-style kanban board built for working with AI agents. You hand work to agents as cards and talk to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag (idle, working, waiting for input, blocked) shows where each card stands. The board's state lives in a SQLite database owned by the application. You change it in the web UI; the `k-spec` command line gives an agent (or you, in a terminal) the same board; an MCP server comes next.

**Current slice:** the web UI and the `k-spec` command line on a SQLite store, behind a token-link access gate. Cards have sequential `#n` numbers; tiles show labels, where a card is being worked (lima instance, worktree or host, plus the branch), an animated status dot for cards waiting for input or blocked, and one progress segment per checklist. Opening a card shows four tabs: Overview (execution summary, description, checklists), Spec (linked markdown files rendered in place), Execution (location, branch, Claude session, tokens, history) and Activity (comments and status changes). The top bar names the project, carries its links, and opens the README in a side sheet. Every edit is saved on the server. Execution data in the sample board is seeded; the CLI's `start`, `end` and `publish` write it for real.

## Running

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
npx k-spec board          # inside the project
npm link                  # once, to have `k-spec` everywhere
```

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

**Finding the server.** A running server writes `data/k-spec.server.json` (its address and token, git-ignored, removed when it stops; `K_SPEC_SERVER_FILE` moves it). Run in the project folder, the CLI reads it and needs no setup. Anywhere else, set `K_SPEC_URL` and `K_SPEC_TOKEN`; a fixed `K_SPEC_TOKEN` on the server keeps that stable across restarts.

**Failures** are one line on stderr starting with `error:`. Exit codes: `0` done, `1` refused (a rule, or a card, lane or item that does not exist), `2` wrong usage, `3` no connection (server not running, not answering, or the token was rejected).

## Requests to the agent

A comment is a note for people. A **request** is a comment addressed to the agent: write it in the card's comment box and press **Send to agent** instead of **Comment** (in a terminal: `k-spec comment <n> "…" --request`). A request is open until an agent comments on that card; the comment shows "waiting for agent" and then "answered", and a card with open requests carries a small count on the board. One agent comment answers every request above it on the card. There is no way to cancel a request yet.

`k-spec watch` is how an agent hears about them. It prints every open request when it starts and each new one within about 2 seconds, one line each, and nothing else:

```
$ k-spec watch
watching k-spec at http://localhost:3000, 1 open request
request #12 Refine the CLI [Backlog, idle] You, 2026-11-19 14:02: Let's plan this feature.
```

The line carries the first 200 characters; the agent reads the rest with `k-spec show 12 --activity`. A request is printed once per run, and again by the next run while it is still open, so nothing is lost when nobody was watching. If the server goes away the watch says so once (`k-spec: server not answering at …`), keeps trying, re-reads the server's note (a restarted server has a new token) and says `k-spec: connected to …` when it is back. It stops on Ctrl-C. `--json` prints one JSON object per line instead.

**In Claude Code.** This repository ships a skill, `.claude/skills/k-spec/SKILL.md`. With it, a session:

- reads the card when you name one in the chat ("let's refine k-spec #12"), with its history and linked files, so you do not have to paste context;
- watches the board when you ask it to ("watch the board"): it runs `k-spec watch` under Claude Code's Monitor tool, which delivers each printed line to the chat and wakes the session. A monitor lives 30 minutes at most, so the agent starts it again each time;
- handles a request: sets the card to `working`, does the work in the session, attaches files it wrote with `k-spec link`, replies once on the card, and sets `waiting` (you have to act) or `idle`.

To make a project's sessions watch from the start, say so in that project's `CLAUDE.md`. To use the skill in another project, link or copy the folder into `~/.claude/skills/k-spec`, put `k-spec` on the path (`npm link`), and tell the CLI where the server is: `K_SPEC_URL` and `K_SPEC_TOKEN`, or `K_SPEC_SERVER_FILE=/path/to/k-spec/data/k-spec.server.json`.

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

Development is test-first: every domain rule, use case, and UI interaction has a test that was written before the code.

## Layout

Domain-driven, in layers under `src/`: `domain` (pure data and rules), `application` (use cases and the command registry), `infrastructure` (SQLite store, seed, access token, HTTP client), `ui` (React components and the board context store), `cli` (the `k-spec` command; its executable is `bin/k-spec.mjs`), `app` (Next.js entry). See `CLAUDE.md` for the layer rules and conventions.

## Roadmap

1. **Board UI** with the token gate, ticket numbers, the tabbed card with linked spec files and execution details, and the project top bar. *(done)*
2. **SQLite store**: commands run on the server and are saved; JSON dump and load for git. *(done)*
3. **CLI**: `k-spec`, a client of the server, the agent's view of the board. *(done)*
4. **Requests to the agent**: "Send to agent" in the browser, `k-spec watch`, and the Claude skill. *(this slice)*
5. **Working agreement on the board**: spec file, approval, the plan as checklists, review, driven through requests.
6. **MCP server**: the same commands as tools, so Claude manages cards without touching files.
7. **Card documents**: where a card's spec markdown lives and how agents attach it.
