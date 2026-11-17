import { boardFromFiles } from "@/infrastructure/kspec/board-from-files.js";

/** A board the way the server builds it, from `{ laneFolder: ["3:Title", …] }`. */
export function boardOf(lanes = {}, name = "Disk board") {
  return boardFromFiles({
    boardYaml: `name: ${name}\n`,
    lanes: Object.fromEntries(
      Object.entries(lanes).map(([folder, cards]) => [
        folder,
        {
          cardsYaml: null,
          cards: cards.map((spec) => {
            const [number, title] = spec.split(":");
            return { dir: `${number}_x`, cardYaml: `title: ${title}\n`, modifiedAt: "2026-11-10T10:00:00.000Z", files: [] };
          }),
        },
      ]),
    ),
  });
}

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/**
 * Installs a fake `fetch` for `/api/board` and `/api/board/version`. Mutate the returned object
 * to change what the "server" answers: `serve(board, version)`, `breakWith(error, file, version)`,
 * `offline = true`. `calls(path)` counts requests.
 */
export function installBoardServer(board, version = "v1") {
  const server = {
    version,
    response: json(200, { board, version }),
    offline: false,
    serve(nextBoard, nextVersion) {
      server.version = nextVersion;
      server.response = json(200, { board: nextBoard, version: nextVersion });
    },
    breakWith(error, file, nextVersion) {
      server.version = nextVersion;
      server.response = json(422, { error, file, version: nextVersion });
    },
    calls: (path) => globalThis.fetch.mock.calls.filter(([url]) => url === path).length,
  };
  globalThis.fetch = vi.fn(async (url) => {
    if (server.offline) throw new TypeError("offline");
    if (url === "/api/board") return server.response;
    if (url === "/api/board/version") return json(200, { version: server.version });
    return json(404, { error: "Not found" });
  });
  return server;
}
