// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { dumpOnShutdown, getServerStore, registerShutdownDump, resetServerStore, startServerStore } from "./server-store.js";

let dir;
const saved = { db: process.env.K_SPEC_DB, dump: process.env.K_SPEC_DUMP };
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-server-"));
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

test("the store is opened once per process", () => {
  expect(getServerStore()).toBe(getServerStore());
});

test("shutting down before the store was used writes nothing and opens nothing", () => {
  expect(dumpOnShutdown()).toBe(false);
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("shutting down after the store was used writes the dump", async () => {
  const { deps } = getServerStore();
  await deps.repository.save({ ...seedBoard(), name: "Edited" });
  expect(dumpOnShutdown()).toBe(true);
  expect(JSON.parse(fs.readFileSync(process.env.K_SPEC_DUMP, "utf8")).board.name).toBe("Edited");
});

test("a dump that cannot be written is logged, not thrown", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  getServerStore();
  fs.mkdirSync(process.env.K_SPEC_DUMP); // a folder sits where the file should go
  expect(() => dumpOnShutdown()).not.toThrow();
  expect(console.error).toHaveBeenCalled();
});

test("the shutdown dump is registered on process exit once, however often it is asked for", () => {
  const before = process.listenerCount("exit");
  registerShutdownDump();
  registerShutdownDump();
  expect(process.listenerCount("exit")).toBe(before + 1);
});

test("starting the server opens the store, so the first request does not have to", () => {
  const exit = vi.fn();
  startServerStore({ exit });
  expect(exit).not.toHaveBeenCalled();
  expect(fs.existsSync(process.env.K_SPEC_DB)).toBe(true);
});

test("starting the server with a broken dump says which file and stops", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  fs.writeFileSync(process.env.K_SPEC_DUMP, "{ nope");
  const exit = vi.fn();
  startServerStore({ exit });
  expect(exit).toHaveBeenCalledWith(1);
  const printed = console.error.mock.calls.flat().join(" ");
  expect(printed).toContain("Dump is not valid JSON");
  expect(printed).toContain(process.env.K_SPEC_DUMP);
});
