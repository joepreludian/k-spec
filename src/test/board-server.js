import { COMMANDS } from "@/application/commands.js";
import { addLane, addNewCard, createBoard } from "@/domain/board.js";
import { DomainError } from "@/domain/errors.js";
import { fixedClock } from "@/infrastructure/clock.js";
import { sequentialIdGenerator } from "@/infrastructure/id-generator.js";
import { createInMemoryBoardRepository } from "@/infrastructure/in-memory-board-repository.js";

const NOW = "2026-11-10T10:00:00.000Z";

/** A small board from `{ "Lane name": ["3:Title", …] }`: lane ids `lane-<name>`, card ids `card-<n>`. */
export function boardOf(lanes = { Backlog: [], Todo: [] }, name = "Test board") {
  let board = createBoard({ id: "board-1", name });
  for (const [laneName, cards] of Object.entries(lanes)) {
    const laneId = `lane-${laneName.toLowerCase().replace(/\s+/g, "-")}`;
    board = addLane(board, { id: laneId, name: laneName });
    for (const spec of cards) {
      const [number, title] = spec.split(":");
      board = { ...board, nextCardNumber: Number(number) };
      board = addNewCard(board, laneId, { id: `card-${number}`, title, now: NOW }).board;
    }
  }
  return board;
}

const redirect = () => ({
  ok: false,
  status: 307,
  redirected: false,
  headers: { get: () => null },
  json: async () => {
    throw new SyntaxError("not json");
  },
});

const isCommand = (name) => Object.hasOwn(COMMANDS, name) && name !== "getBoard";

function parseInput(text) {
  try {
    const input = JSON.parse(text);
    return typeof input === "object" && input !== null && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  redirected: false,
  headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
  json: async () => body,
});

/**
 * Installs a fake `fetch` that behaves like the server: `GET /api/board`, `GET /api/board/version`
 * and `POST /api/commands/<name>`, which runs the real use case on the server's board and bumps
 * the version. `serve(board, version)` is another client changing the board; `offline = true`
 * makes every request fail; `hold()` keeps answers back until the returned function is called;
 * `afterRead(server)` runs once after the next board read (another client getting in between);
 * `refuse(name)` makes a command answer 422; `deps` is what its use cases run with.
 * `calls(path)` counts requests and `requests` lists them as `{ method, path, input }`.
 *
 * For a caller outside the browser, `{ baseUrl, token }` make it one origin behind the access
 * gate: other URLs are not found, and a request without the token cookie is redirected (307).
 */
export function installBoardServer(board, version = 1, { baseUrl = "", token = null } = {}) {
  const deps = { clock: fixedClock(NOW), idGenerator: sequentialIdGenerator("srv") };
  const server = {
    version,
    token, // settable: a restarted server has a new one
    offline: false,
    gate: null,
    requests: [],
    afterRead: null,
    refuse: null,
    get deps() {
      return { ...deps, repository: server.repository };
    },
    repository: createInMemoryBoardRepository(board),
    serve(nextBoard, nextVersion) {
      server.version = nextVersion;
      server.repository = createInMemoryBoardRepository(nextBoard);
    },
    hold() {
      let release;
      server.gate = new Promise((resolve) => (release = resolve));
      return () => {
        server.gate = null;
        release();
      };
    },
    calls: (path) => globalThis.fetch.mock.calls.filter(([url]) => url === path).length,
  };

  async function answer(fullUrl, options) {
    if (!fullUrl.startsWith(baseUrl)) return json(404, { error: "Not found" });
    const url = fullUrl.slice(baseUrl.length);
    if (server.token !== null && options?.headers?.Cookie !== `k-spec-token=${server.token}`) return redirect();
    const method = options?.method ?? "GET";
    const input = method === "POST" ? (parseInput(options.body) ?? undefined) : undefined;
    server.requests.push({ method, path: url, input });
    if (url === "/api/board") {
      const response = json(200, { board: await server.repository.load(), version: server.version });
      const hook = server.afterRead;
      server.afterRead = null;
      if (hook) await hook(server);
      return response;
    }
    if (url === "/api/board/version") return json(200, { version: server.version });
    if (url.startsWith("/api/commands/") && options?.method === "POST") {
      const name = url.slice("/api/commands/".length);
      if (!isCommand(name)) return json(404, { error: `Unknown command: ${name}` });
      if (!input) return json(400, { error: "Body must be a JSON object" });
      try {
        if (server.refuse?.(name)) throw new DomainError("Refused by the test", "REFUSED");
        const result = await COMMANDS[name](server.deps, input);
        server.version += 1;
        return json(200, { ...result, version: server.version });
      } catch (error) {
        if (error instanceof DomainError) return json(422, { error: error.message, code: error.code });
        return json(500, { error: "Command failed" });
      }
    }
    return json(404, { error: "Not found" });
  }

  globalThis.fetch = vi.fn(async (url, options) => {
    if (server.offline) throw new TypeError("offline");
    const response = await answer(url, options);
    if (server.gate) await server.gate;
    return response;
  });
  return server;
}
