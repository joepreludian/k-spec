// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET as getFile } from "../files/[...path]/route.js";
import { GET } from "./route.js";
import { GET as getVersion } from "./version/route.js";

let root;
const saved = process.env.K_SPEC_ROOT;
const write = async (relative, content) => {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kspec-api-"));
  process.env.K_SPEC_ROOT = root;
  await write("board.yaml", "name: From disk\n");
  await write("lanes/todo/3_watcher/card.yaml", "title: Watcher\n");
  await write("lanes/todo/3_watcher/files/design.md", "# design");
});
afterEach(async () => {
  if (saved === undefined) delete process.env.K_SPEC_ROOT;
  else process.env.K_SPEC_ROOT = saved;
  await fs.rm(root, { recursive: true, force: true });
});

test("GET /api/board returns the board and its version, uncached", async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const { board, version } = await res.json();
  expect(board.name).toBe("From disk");
  expect(board.lanes[1].cards[0].links).toEqual([
    { id: "card-3-file-design.md", title: "design", path: "kspec-cards/3/design.md" },
  ]);
  expect(version).toMatch(/^[0-9a-f]{40}$/);
});

test("GET /api/board answers 422 with the error and file when a file is broken", async () => {
  await write("lanes/todo/3_watcher/card.yaml", "description: no title\n");
  const res = await GET();
  expect(res.status).toBe(422);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json();
  expect(body.file).toBe("lanes/todo/3_watcher/card.yaml");
  expect(typeof body.error).toBe("string");
  expect(body.version).toMatch(/^[0-9a-f]{40}$/);
});

test("GET /api/board/version matches the board's version and follows changes", async () => {
  const { version } = await (await GET()).json();
  const res = await getVersion();
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ version });
  await write("lanes/todo/3_watcher/card.yaml", "title: Renamed watcher\n");
  expect((await (await getVersion()).json()).version).not.toBe(version);
});

test("GET /api/files serves a card file through the kspec-cards prefix", async () => {
  const segments = ["kspec-cards", "3", "design.md"];
  const res = await getFile(new Request("http://localhost/api/files/kspec-cards/3/design.md"), {
    params: Promise.resolve({ path: segments }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ path: "kspec-cards/3/design.md", content: "# design" });
});
