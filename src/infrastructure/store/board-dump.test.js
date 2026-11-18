// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { DumpError, dumpBoardSync, loadDumpSync, parseDump, serializeDump } from "./board-dump.js";
import { openDatabase } from "./open-database.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

let dir;
let file;
const opened = [];
const newRepository = () => {
  const database = openDatabase(":memory:");
  opened.push(database);
  return createSqliteBoardRepository(database.db);
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-dump-"));
  file = path.join(dir, "sub", "board.dump.json");
});
afterEach(() => {
  opened.splice(0).forEach((d) => d.close());
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a dump loaded into a fresh database gives the same board", () => {
  const source = newRepository();
  source.replaceSync(seedBoard());
  dumpBoardSync({ repository: source, file });
  const target = newRepository();
  loadDumpSync({ repository: target, file });
  expect(target.readSync()).toStrictEqual(seedBoard());
});

test("the dump is stable, sorted, readable json and leaves no temp file", () => {
  const repository = newRepository();
  repository.replaceSync(seedBoard());
  dumpBoardSync({ repository, file });
  const first = fs.readFileSync(file, "utf8");
  dumpBoardSync({ repository, file });
  expect(fs.readFileSync(file, "utf8")).toBe(first);
  expect(first.endsWith("}\n")).toBe(true);
  expect(first.split("\n").length).toBeGreaterThan(50);
  expect(JSON.parse(first)).toStrictEqual({ format: 1, board: seedBoard() });
  expect(first.indexOf('"board"')).toBeLessThan(first.indexOf('"format"'));
  expect(fs.readdirSync(path.dirname(file))).toEqual(["board.dump.json"]);
});

test("serializing does not depend on the order keys were added", () => {
  expect(serializeDump({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } })).toBe(
    serializeDump({ a: { c: null, d: [{ y: 2, z: 1 }] }, b: 1 }),
  );
});

test("loading replaces the stored board and bumps the version", () => {
  const repository = newRepository();
  repository.replaceSync(seedBoard());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeDump({ ...seedBoard(), name: "From the dump" }));
  loadDumpSync({ repository, file });
  expect(repository.readSync().name).toBe("From the dump");
  expect(repository.version()).toBe(2);
});

test.each([
  ["broken json", "{ nope", "Dump is not valid JSON"],
  ["an unknown format", '{"format":2,"board":{}}', "Unsupported dump format: 2"],
  ["no board", '{"format":1}', "Dump has no board"],
  ["a non-object", "[1]", "Dump has no board"],
  ["a board that cannot be stored", '{"format":1,"board":{"lanes":"x"}}', "Dump could not be stored"],
])("a dump with %s fails naming the file and leaves the database alone", (_, text, message) => {
  const repository = newRepository();
  repository.replaceSync(seedBoard());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  let error;
  try {
    loadDumpSync({ repository, file });
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DumpError);
  expect(error.message).toBe(message);
  expect(error.file).toBe(file);
  expect(repository.readSync()).toStrictEqual(seedBoard());
  expect(repository.version()).toBe(1);
});

test("a missing dump file is a DumpError", () => {
  const repository = newRepository();
  expect(() => loadDumpSync({ repository, file })).toThrow(DumpError);
  expect(() => loadDumpSync({ repository, file })).toThrow("Dump file not found");
});

test("parseDump returns the board", () => {
  expect(parseDump('{"format":1,"board":{"name":"x"}}', "f")).toEqual({ name: "x" });
});
