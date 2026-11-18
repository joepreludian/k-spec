// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { DumpError, serializeDump } from "./board-dump.js";
import { openStore, storePaths } from "./open-store.js";

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
  expect(storePaths({}, "/x")).toEqual({ dbFile: "/x/data/k-spec.db", dumpFile: "/x/data/k-spec.dump.json" });
  expect(storePaths({ K_SPEC_DB: "/a/b.db", K_SPEC_DUMP: "/c/d.json" }, "/x")).toEqual({
    dbFile: "/a/b.db",
    dumpFile: "/c/d.json",
  });
});
