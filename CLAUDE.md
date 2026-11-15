# k-spec

## Purpose

k-spec is a Trello-style kanban board where a person hands work to AI agents as cards and talks to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag shows whether an agent is idle, working, waiting for input, or blocked. Long-term the board is mirrored to files under a project's `docs/k-spec` folder, served from a Docker container, and driven by a CLI. The current slice is the web UI on an in-memory store with seed data, behind a token-link access gate.

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
  ui/              React components, the board context store (useBoard).
  components/ui/   shadcn-generated primitives.
  app/             Next.js App Router entry; wires everything together.
proxy.js           Next 16 request proxy (middleware) for the token gate.
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
K_SPEC_HOST=my-host npm run dev    # host name used in the printed access link
```

The server prints `k-spec board: http://<host>:<port>/?token=…` on start. Opening that link sets the `k-spec-token` cookie; without it every page redirects to `/access`. The gate lives in `src/proxy.js` and `src/infrastructure/access/`.

## Git

- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`).
- Never push. The user pushes.
- No `Co-Authored-By` trailers.
- `docs/specs/` is not committed.

## Specs

Design documents and implementation plans live in `docs/specs/` (git-ignored). Read the current design and plan there before changing the project.
