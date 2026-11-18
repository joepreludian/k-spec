// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { serializeDump } from "./board-dump.js";
import { openStore } from "./open-store.js";

let dir;
let paths;
const script = (name) =>
  spawnSync(process.execPath, ["--import", "./scripts/register-alias.mjs", `scripts/${name}.mjs`], {
    env: { ...process.env, K_SPEC_DB: paths.dbFile, K_SPEC_DUMP: paths.dumpFile },
    encoding: "utf8",
  });
const storedName = () => {
  const store = openStore(paths);
  const { name } = store.repository.readSync();
  store.close();
  return name;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-scripts-"));
  paths = { dbFile: path.join(dir, "k.db"), dumpFile: path.join(dir, "k.dump.json") };
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("db:dump writes the stored board to the dump file", () => {
  const run = script("db-dump");
  expect(run.status).toBe(0);
  expect(run.stdout).toContain(`Dumped the board to ${paths.dumpFile}`);
  expect(JSON.parse(fs.readFileSync(paths.dumpFile, "utf8"))).toEqual({ format: 1, board: seedBoard() });
});

test("db:load replaces the stored board with the dump, even when a database exists", () => {
  expect(storedName()).toBe(seedBoard().name);
  fs.writeFileSync(paths.dumpFile, serializeDump({ ...seedBoard(), name: "Pulled from git" }));
  const run = script("db-load");
  expect(run.status).toBe(0);
  expect(run.stdout).toContain(`Loaded the board from ${paths.dumpFile}`);
  expect(storedName()).toBe("Pulled from git");
});

test("db:load with a broken dump exits 1 naming the file and leaves the database alone", () => {
  expect(storedName()).toBe(seedBoard().name);
  fs.writeFileSync(paths.dumpFile, "{ nope");
  const run = script("db-load");
  expect(run.status).toBe(1);
  expect(run.stderr).toContain("Dump is not valid JSON");
  expect(run.stderr).toContain(paths.dumpFile);
  expect(storedName()).toBe(seedBoard().name);
});

test("db:load on a new project with no dump exits 1 instead of loading nothing", () => {
  const run = script("db-load");
  expect(run.status).toBe(1);
  expect(run.stderr).toContain("Dump file not found");
});
