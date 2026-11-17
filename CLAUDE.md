# k-spec

## Purpose

k-spec is a Trello-style kanban board where a person hands work to AI agents as cards and talks to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag shows whether an agent is idle, working, waiting for input, or blocked. Long-term the board is mirrored to files under a project's `docs/k-spec` folder, served from a Docker container, and driven by a CLI. The current slice is the web UI, behind a token-link access gate, reading the board from a `kspec-root` folder (`board.yaml`, one folder per fixed lane with a `cards.yaml` order, one folder per card with `card.yaml` and `files/*.md`); nothing is written back yet, so edits made in the browser live in memory and are replaced when the board reloads: cards carry sequential `#n` numbers, the card dialog has Overview / Spec / Execution / Activity tabs (Spec renders linked markdown files from the project; Execution shows where a card is being worked and the Claude session behind it, seeded for now), and the top bar names the project with links and a README sheet. A card's active work can also carry published services (title + URL, set through the `publishService` / `unpublishService` commands, seeded for now): the board card shows a globe that turns green when the browser's live check (`src/ui/shared/use-service-status.js`, a `no-cors` fetch) gets an answer, and the Overview tab lists them as new-tab buttons.

## Stack

Node 24, npm, Next.js 16 (App Router, JavaScript), React 19, Tailwind CSS 4, shadcn/ui (JSX mode), dnd-kit, react-markdown, Vitest + Testing Library + jsdom, lucide-react, sonner.

## Layout

```
src/
  domain/          pure JS, no React, no Next. Entities as plain objects,
                   pure functions returning new objects, domain errors.
  application/     use cases over the BoardRepository port; the command
                   registry (name -> use case).
  infrastructure/  in-memory repository, seed board, clock, ids, local
                   command executor, access-token logic.
    kspec/         the kspec-root format: files <-> board mapper, disk reader,
                   change version, card files, seed export.
  ui/              React components, the board context store (useBoard).
  components/ui/   shadcn-generated primitives.
  app/             Next.js App Router entry; wires everything together.
    api/board/             GET /api/board: { board, version } read from the kspec root (422 { error, file } on a bad file)
    api/board/version/     GET /api/board/version: { version }, polled by the browser every 5 s
    api/files/[...path]/   GET /api/files/<path>: read-only markdown from the project dir, or from a card's
                           files/ folder for kspec-cards/<number>/<file>
    files/[...path]/       /files/<path>: full-page view of one markdown file
  proxy.js         Next 16 request proxy (middleware) for the token gate.
scripts/           export-seed.mjs and the `@/` alias hook for plain node.
kspec-root/        sample board data (the exported seed), committed.
```

Dependency rule: `ui -> application -> domain`. `infrastructure` implements ports and is injected at the edge (`src/app`). Nothing in `domain` or `application` imports from `ui`, `infrastructure`, `react`, or `next`.

## Rules

- **TDD is mandatory.** Write the failing test first, watch it fail, write the minimal code, watch it pass, refactor. No production code without a failing test.
- **Domain is pure JavaScript.** No framework imports, no side effects, immutable updates, ISO-8601 string timestamps. Everything must serialize to plain JSON (a card will become a markdown-with-frontmatter file later).
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
K_SPEC_ROOT=/path npm run dev          # folder the board is read from (default: ./kspec-root)
npm run export-seed [-- <dir>] [-- --force]   # write the seed board as a kspec root (refuses a non-empty folder without --force)
```

The server prints `k-spec board: http://<host>:<port>/?token=…` on start. Opening that link sets the `k-spec-token` cookie; without it every page redirects to `/access`. The gate lives in `src/proxy.js` and `src/infrastructure/access/`.

When the browser reaches the dev server through any host other than `localhost` (a LAN name, a Lima/VM host name), set `K_SPEC_HOST` to that host. `next.config.mjs` passes it to `allowedDevOrigins`; otherwise Next rejects the hot-reload websocket and the Turbopack dev client never hydrates, so the board renders but nothing responds to clicks. Plain-http pages on such hosts are not secure contexts, so ids come from `createIdGenerator` (`src/infrastructure/id-generator.js`), which falls back to `getRandomValues` when `crypto.randomUUID` is missing.

The file viewer (`/api/files/<path>`, `/files/<path>`, the README sheet, the card Spec tab) serves only `.md`/`.markdown` files inside `K_SPEC_PROJECT_DIR`, capped at 1 MiB, behind the same token; the path rule is `src/domain/markdown-path.js` and the resolver is `src/infrastructure/files/`.

## kspec-root

The board is whatever is in `K_SPEC_ROOT`. The format lives in `src/infrastructure/kspec/` (`format.js` has the fixed lanes; `board-from-files.js` reads, `board-to-files.js` writes) and is described in `docs/specs/2026-11-16-k-spec-filesystem-read-design.md`. Keys are `snake_case`, values keep the domain spelling, unknown keys are ignored, and no ids are stored: the reader builds them from position (`card-3`, `card-3-comment-1`). A card is identified by the number its folder name starts with; every markdown file directly in its `files/` folder is a tile in the Spec tab. A file with bad content fails the whole read with the file named: a full-page error on first load, a banner over the last good board on a refresh. A missing folder is the five empty lanes.

## Git

- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`).
- Never push. The user pushes.
- No `Co-Authored-By` trailers.
- `docs/specs/` is not committed.

## Specs

Design documents and implementation plans live in `docs/specs/` (git-ignored). Read the current design and plan there before changing the project.
