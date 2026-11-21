// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { serializeDump } from "./board-dump.js";
import { openStore } from "./open-store.js";
import { dumpOnShutdown, getServerStore, registerShutdownDump, resetServerStore, savingNotice, startServerStore } from "./server-store.js";

let dir;
const saved = { db: process.env.K_SPEC_DB, dump: process.env.K_SPEC_DUMP, auto: process.env.K_SPEC_AUTO_DUMP };
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-server-"));
  process.env.K_SPEC_DB = path.join(dir, "k.db");
  process.env.K_SPEC_DUMP = path.join(dir, "k.dump.json");
  delete process.env.K_SPEC_AUTO_DUMP;
});
afterEach(() => {
  resetServerStore();
  restore("K_SPEC_DB", saved.db);
  restore("K_SPEC_DUMP", saved.dump);
  restore("K_SPEC_AUTO_DUMP", saved.auto);
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

const dumpedName = () => JSON.parse(fs.readFileSync(process.env.K_SPEC_DUMP, "utf8")).board.name;
const edit = async (name) => {
  const store = getServerStore();
  await store.deps.repository.save({ ...seedBoard(), name });
  return store;
};

test("after a change the dump holds the board while the server runs", async () => {
  const store = await edit("Edited");
  store.saved();
  expect(dumpedName()).toBe("Edited");
});

test("with saving off a change writes nothing until the server stops", async () => {
  process.env.K_SPEC_AUTO_DUMP = "off";
  const store = await edit("Edited");
  store.saved();
  expect(fs.existsSync(process.env.K_SPEC_DUMP)).toBe(false);
  expect(dumpOnShutdown()).toBe(true);
  expect(dumpedName()).toBe("Edited");
});

test("with saving on, stopping leaves the dump alone", async () => {
  const store = await edit("Edited");
  store.saved();
  // Someone else (a git pull) replaces the file while the server runs.
  fs.writeFileSync(process.env.K_SPEC_DUMP, serializeDump({ ...seedBoard(), name: "Pulled" }));
  expect(dumpOnShutdown()).toBe(false);
  expect(dumpedName()).toBe("Pulled");
});

test("a dump that could not be written is logged, written by the next change, and by stopping if none comes", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const store = await edit("Edited");
  fs.rmSync(process.env.K_SPEC_DUMP);
  fs.mkdirSync(process.env.K_SPEC_DUMP); // a folder sits where the file should go
  expect(() => store.saved()).not.toThrow();
  expect(console.error.mock.calls.flat().join(" ")).toContain(process.env.K_SPEC_DUMP);
  expect(dumpOnShutdown()).toBe(true); // the server holds a change the file does not have
  fs.rmdirSync(process.env.K_SPEC_DUMP);
  store.saved();
  expect(dumpedName()).toBe("Edited");
  expect(dumpOnShutdown()).toBe(false);
});

test("a dump that cannot be written when the server stops is logged, not thrown", () => {
  process.env.K_SPEC_AUTO_DUMP = "off";
  vi.spyOn(console, "error").mockImplementation(() => {});
  getServerStore();
  fs.mkdirSync(process.env.K_SPEC_DUMP); // a folder sits where the file should go
  expect(() => dumpOnShutdown()).not.toThrow();
  expect(console.error).toHaveBeenCalled();
});

test("the notice names the dump and the mode", () => {
  expect(savingNotice()).toContain(process.env.K_SPEC_DUMP);
  expect(savingNotice()).toContain("every change");
  process.env.K_SPEC_AUTO_DUMP = "off";
  expect(savingNotice()).toContain(process.env.K_SPEC_DUMP);
  expect(savingNotice()).toContain("K_SPEC_AUTO_DUMP");
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

const T = 1763600000000;
/** A database that holds a board called "Old" and a dump that holds one called "Pulled". */
const oldDatabaseAndPulledDump = () => {
  const store = openStore({ dbFile: process.env.K_SPEC_DB, dumpFile: process.env.K_SPEC_DUMP });
  store.repository.replaceSync({ ...seedBoard(), name: "Old" });
  store.close();
  fs.writeFileSync(process.env.K_SPEC_DUMP, serializeDump({ ...seedBoard(), name: "Pulled" }));
};

test("the server's first version comes from the clock", () => {
  vi.spyOn(Date, "now").mockReturnValue(T);
  expect(getServerStore().deps.repository.version()).toBe(T);
});

test("a database thrown away never hands out a version it had before", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(T);
  const { deps } = getServerStore();
  for (const name of ["a", "b", "c"]) await deps.repository.save({ ...seedBoard(), name });
  const reached = deps.repository.version();
  resetServerStore();
  for (const file of fs.readdirSync(dir)) if (file.startsWith("k.db")) fs.rmSync(path.join(dir, file));
  now.mockReturnValue(T + 1000);
  expect(getServerStore().deps.repository.version()).toBeGreaterThan(reached);
});

test("with saving on, a server that starts takes the dump over its database", () => {
  oldDatabaseAndPulledDump();
  const exit = vi.fn();
  startServerStore({ exit });
  expect(exit).not.toHaveBeenCalled();
  expect(getServerStore().repository.readSync().name).toBe("Pulled");
});

test("with saving off, a server that starts keeps its database", () => {
  process.env.K_SPEC_AUTO_DUMP = "off";
  oldDatabaseAndPulledDump();
  startServerStore({ exit: vi.fn() });
  expect(getServerStore().repository.readSync().name).toBe("Old");
});

test("with saving on and a broken dump, a server whose database has a board still stops", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  oldDatabaseAndPulledDump();
  fs.writeFileSync(process.env.K_SPEC_DUMP, "<<<<<<< HEAD");
  const exit = vi.fn();
  startServerStore({ exit });
  expect(exit).toHaveBeenCalledWith(1);
  expect(console.error.mock.calls.flat().join(" ")).toContain(process.env.K_SPEC_DUMP);
});

test("with saving on and no dump yet, the first board is written to it as the store opens", () => {
  getServerStore();
  expect(dumpedName()).toBe(seedBoard().name);
});

test("with saving off, opening the store writes no dump", () => {
  process.env.K_SPEC_AUTO_DUMP = "off";
  getServerStore();
  expect(fs.existsSync(process.env.K_SPEC_DUMP)).toBe(false);
});

test("a change whose write failed is written when the server stops, if no other change came", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const store = await edit("Edited");
  fs.rmSync(process.env.K_SPEC_DUMP);
  fs.mkdirSync(process.env.K_SPEC_DUMP);
  store.saved();
  fs.rmdirSync(process.env.K_SPEC_DUMP);
  expect(dumpOnShutdown()).toBe(true);
  expect(dumpedName()).toBe("Edited");
});
