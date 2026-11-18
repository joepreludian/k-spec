// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { resetServerStore } from "@/infrastructure/store/server-store.js";
import { GET as getFile } from "../files/[...path]/route.js";
import { GET } from "./route.js";
import { GET as getVersion } from "./version/route.js";

let dir;
const saved = { db: process.env.K_SPEC_DB, dump: process.env.K_SPEC_DUMP };
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-api-"));
  process.env.K_SPEC_DB = path.join(dir, "k.db");
  process.env.K_SPEC_DUMP = path.join(dir, "k.dump.json");
});
afterEach(() => {
  resetServerStore();
  restore("K_SPEC_DB", saved.db);
  restore("K_SPEC_DUMP", saved.dump);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("GET /api/board returns the stored board and its version, uncached", async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const { board, version } = await res.json();
  expect(board).toEqual(seedBoard());
  expect(version).toBe(1);
});

test("GET /api/board/version returns the same version, uncached", async () => {
  const { version } = await (await GET()).json();
  const res = await getVersion();
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ version });
});

test("GET /api/files no longer knows card folders: such a path is an ordinary project path", async () => {
  const segments = ["kspec-cards", "3", "design.md"];
  const res = await getFile(new Request("http://localhost/api/files/kspec-cards/3/design.md"), {
    params: Promise.resolve({ path: segments }),
  });
  expect(res.status).toBe(404);
});
