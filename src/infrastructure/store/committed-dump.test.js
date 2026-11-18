// @vitest-environment node
import fs from "node:fs";
import { parseDump, serializeDump } from "./board-dump.js";
import { openDatabase } from "./open-database.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

const FILE = "data/k-spec.dump.json";

test("the committed dump loads, and is exactly what the application would write", () => {
  const text = fs.readFileSync(FILE, "utf8");
  const board = parseDump(text, FILE);
  const database = openDatabase(":memory:");
  const repository = createSqliteBoardRepository(database.db);
  repository.replaceSync(board);
  expect(repository.readSync()).toStrictEqual(board);
  expect(serializeDump(repository.readSync())).toBe(text);
  database.close();
});
