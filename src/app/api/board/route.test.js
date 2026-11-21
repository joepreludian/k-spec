// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { resetServerStore } from "@/infrastructure/store/server-store.js";
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
  vi.restoreAllMocks();
});

test("GET /api/board returns the stored board and its version, uncached", async () => {
  // A server's first version is the clock's, so that a database thrown away never repeats one.
  vi.spyOn(Date, "now").mockReturnValue(1763600000000);
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const { board, version } = await res.json();
  expect(board).toEqual(seedBoard());
  expect(version).toBe(1763600000000);
});

test("GET /api/board/version returns the same version, uncached", async () => {
  const { version } = await (await GET()).json();
  const res = await getVersion();
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ version });
});
