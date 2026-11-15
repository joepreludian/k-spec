# k-spec

A Trello-style kanban board built for working with AI agents. You hand work to agents as cards and talk to them on the card: the description is the spec, checklists define "done", comments are the back-and-forth, and an agent status tag (idle, working, waiting for input, blocked) shows where each card stands. The board will be mirrored to files under a project's `docs/k-spec` folder, served from a Docker container, and driven by a CLI so agents can manage it themselves.

**Current slice:** the web UI on an in-memory store with seed data, behind a token-link access gate. Nothing persists yet; reloading resets to the seed.

## Running

```bash
npm install
npm run dev
```

The server prints an access link on start:

```
  k-spec board: http://localhost:3000/?token=…
```

Open that link once; it sets a cookie and you land on the board. Anyone hitting the board without the cookie is sent to `/access` and asked for the token. Without `K_SPEC_TOKEN` a new token is generated on every start, which invalidates the cookie in your browser. For daily use copy `.env.example` to `.env.local` and set `K_SPEC_TOKEN` to any random string; `.env.local` is git-ignored. `K_SPEC_HOST` changes the host shown in the link (useful over LAN, Tailscale, or a DNS name).

## Testing

```bash
npm test          # vitest, whole suite once
npm run test:watch
npm run lint
npm run build
```

Development is test-first: every domain rule, use case, and UI interaction has a test that was written before the code.

## Layout

Domain-driven, in layers under `src/`: `domain` (pure data and rules), `application` (use cases and the command registry), `infrastructure` (in-memory repository, seed, access token), `ui` (React components and the board context store), `app` (Next.js entry). See `CLAUDE.md` for the layer rules and conventions.

## Roadmap

1. **Board UI** on an in-memory store with the token gate. *(this slice)*
2. **File-backed store**: lanes as folders and cards as markdown with frontmatter under `docs/k-spec`, with a file watcher pushing changes to the UI.
3. **API and CLI**: Next.js route handlers exposing the same commands, a `k-spec-cli` that calls them with the same token, and a Dockerfile plus compose service that prints the access link.
4. **Claude integration** that watches the board and works tickets.
