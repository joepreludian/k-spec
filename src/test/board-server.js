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
 * `calls(path)` counts requests.
 */
export function installBoardServer(board, version = 1) {
  const deps = { clock: fixedClock(NOW), idGenerator: sequentialIdGenerator("srv") };
  const server = {
    version,
    offline: false,
    gate: null,
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

  async function answer(url, options) {
    if (url === "/api/board") return json(200, { board: await server.repository.load(), version: server.version });
    if (url === "/api/board/version") return json(200, { version: server.version });
    if (url.startsWith("/api/commands/") && options?.method === "POST") {
      const name = url.slice("/api/commands/".length);
      try {
        const result = await COMMANDS[name]({ ...deps, repository: server.repository }, JSON.parse(options.body));
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
