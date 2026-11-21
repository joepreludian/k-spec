// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { starterBoard } from "@/infrastructure/starter-board.js";
import { DumpError, serializeDump } from "./board-dump.js";
import { autoDumpEnabled, openStore, storePaths } from "./open-store.js";

let dir;
let paths;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-store-"));
  paths = { dbFile: path.join(dir, "data", "k.db"), dumpFile: path.join(dir, "data", "k.dump.json") };
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const writeDump = (text) => {
  fs.mkdirSync(path.dirname(paths.dumpFile), { recursive: true });
  fs.writeFileSync(paths.dumpFile, text);
};
const nameAfterOpen = () => {
  const store = openStore(paths);
  const { name } = store.repository.readSync();
  store.close();
  return name;
};

test("no database and no dump: the sample board", () => {
  const store = openStore(paths);
  expect(store.repository.readSync()).toStrictEqual(seedBoard());
  store.close();
});

test("no database and a dump: the dump is imported", () => {
  writeDump(serializeDump({ ...seedBoard(), name: "Dumped" }));
  expect(nameAfterOpen()).toBe("Dumped");
});

test("an existing database ignores the dump", () => {
  writeDump(serializeDump({ ...seedBoard(), name: "First" }));
  expect(nameAfterOpen()).toBe("First");
  writeDump(serializeDump({ ...seedBoard(), name: "Second" }));
  expect(nameAfterOpen()).toBe("First");
});

test("a broken dump fails loudly and is imported once fixed", () => {
  writeDump("{ nope");
  let error;
  try {
    openStore(paths);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DumpError);
  expect(error.file).toBe(paths.dumpFile);
  writeDump(serializeDump({ ...seedBoard(), name: "Fixed" }));
  expect(nameAfterOpen()).toBe("Fixed");
});

test("dump() writes the dump file and load() reads it back", () => {
  const store = openStore(paths);
  store.dump();
  expect(JSON.parse(fs.readFileSync(paths.dumpFile, "utf8")).board).toStrictEqual(seedBoard());
  writeDump(serializeDump({ ...seedBoard(), name: "Pulled" }));
  store.load();
  expect(store.repository.readSync().name).toBe("Pulled");
  store.close();
});

test("paths default to data/ under the working directory and follow the environment", () => {
  expect(storePaths({}, "/x")).toEqual({ dbFile: "/x/data/k-spec.db", dumpFile: "/x/data/k-spec.dump.json", boardName: null });
  expect(storePaths({ K_SPEC_DB: "/a/b.db", K_SPEC_DUMP: "/c/d.json" }, "/x")).toEqual({
    dbFile: "/a/b.db",
    dumpFile: "/c/d.json",
    boardName: null,
  });
});

test("K_SPEC_BOARD_NAME names the first board; blank means none", () => {
  expect(storePaths({ K_SPEC_BOARD_NAME: " My App " }, "/x").boardName).toBe("My App");
  expect(storePaths({ K_SPEC_BOARD_NAME: "  " }, "/x").boardName).toBeNull();
});

test("no database, no dump and a board name: an empty board with that name", () => {
  const store = openStore({ ...paths, boardName: "My App" });
  expect(store.repository.readSync()).toStrictEqual(starterBoard("My App"));
  store.close();
});

test("a dump still wins over the board name", () => {
  writeDump(serializeDump({ ...seedBoard(), name: "Dumped" }));
  const store = openStore({ ...paths, boardName: "My App" });
  expect(store.repository.readSync().name).toBe("Dumped");
  store.close();
});

test("a database that has a board keeps it when the board name changes", () => {
  openStore({ ...paths, boardName: "First" }).close();
  const store = openStore({ ...paths, boardName: "Second" });
  expect(store.repository.readSync().name).toBe("First");
  store.close();
});

test("saving on every change is on unless K_SPEC_AUTO_DUMP says off", () => {
  for (const value of ["off", "OFF", " 0 ", "false", "no"]) expect(autoDumpEnabled({ K_SPEC_AUTO_DUMP: value })).toBe(false);
  for (const env of [{}, { K_SPEC_AUTO_DUMP: "" }, { K_SPEC_AUTO_DUMP: "on" }, { K_SPEC_AUTO_DUMP: "1" }]) expect(autoDumpEnabled(env)).toBe(true);
});

const storeNamed = (name) => {
  const store = openStore(paths);
  store.repository.replaceSync({ ...seedBoard(), name });
  const version = store.repository.version();
  store.close();
  return version;
};

test("asked to start from the dump, a database that has a board is replaced by it, in one load", () => {
  const before = storeNamed("Old");
  writeDump(serializeDump({ ...seedBoard(), name: "Pulled" }));
  const store = openStore({ ...paths, startFromDump: true });
  expect(store.repository.readSync().name).toBe("Pulled");
  expect(store.repository.version()).toBe(before + 1);
  store.close();
});

test("asked to start from the dump, an empty database is filled from it once", () => {
  writeDump(serializeDump({ ...seedBoard(), name: "Pulled" }));
  const store = openStore({ ...paths, startFromDump: true, firstVersion: () => 500 });
  expect(store.repository.readSync().name).toBe("Pulled");
  expect(store.repository.version()).toBe(500);
  store.close();
});

test("asked to start from the dump when there is none, the database is filled as usual and no dump is written", () => {
  const store = openStore({ ...paths, boardName: "My App", startFromDump: true });
  expect(store.repository.readSync().name).toBe("My App");
  store.close();
  expect(fs.existsSync(paths.dumpFile)).toBe(false);
});

test("a dump that cannot be read stops the opening even when the database has a board", () => {
  storeNamed("Old");
  writeDump("{ nope");
  let error;
  try {
    openStore({ ...paths, startFromDump: true });
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DumpError);
  expect(error.file).toBe(paths.dumpFile);
  // The database was closed and not changed: without the request it opens and reads the old board.
  expect(nameAfterOpen()).toBe("Old");
});
