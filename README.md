# k-spec

A Trello-style kanban board built for working with AI agents. You hand work to agents as cards and talk to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag (idle, working, waiting for input, blocked) shows where each card stands. The board's state lives in a SQLite database owned by the application. You change it in the web UI; a CLI and an MCP server will let automation and agents run the same commands.

**Current slice:** the web UI on an in-memory store with seed data, behind a token-link access gate. Cards have sequential `#n` numbers; tiles show labels, where a card is being worked (lima instance, worktree or host, plus the branch), an animated status dot for cards waiting for input or blocked, and one progress segment per checklist. Opening a card shows four tabs: Overview (execution summary, description, checklists), Spec (linked markdown files rendered in place), Execution (location, branch, Claude session, tokens, history) and Activity (comments and status changes). The top bar names the project, carries its links, and opens the README in a side sheet. Execution data is seeded for now; the CLI slice will write it. Nothing persists yet; reloading resets to the seed.

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

Domain-driven, in layers under `src/`: `domain` (pure data and rules), `application` (use cases and the command registry), `infrastructure` (SQLite store, seed, access token), `ui` (React components and the board context store), `app` (Next.js entry). See `CLAUDE.md` for the layer rules and conventions.

## Roadmap

1. **Board UI** with the token gate, ticket numbers, the tabbed card with linked spec files and execution details, and the project top bar. *(done)*
2. **SQLite store**: commands run on the server and are saved; JSON dump and load for git. *(this slice)*
3. **CLI**: a client of the server's commands endpoint, for small automation.
4. **MCP server**: the same commands as tools, so Claude manages cards without touching files.
5. **Card documents**: where a card's spec markdown lives and how agents attach it.
