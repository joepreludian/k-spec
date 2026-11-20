// @vitest-environment node
import { EmptyTitle } from "@/domain/errors.js";
import { seedBoard } from "./seed-board.js";
import { STANDARD_LANES, starterBoard } from "./starter-board.js";
import { parseDump, serializeDump } from "./store/board-dump.js";
import { openDatabase } from "./store/open-database.js";
import { createSqliteBoardRepository } from "./store/sqlite-board-repository.js";

test("a starter board is empty: the name, the five standard lanes, nothing else", () => {
  expect(starterBoard("My App")).toStrictEqual({
    id: "board-1",
    name: "My App",
    lanes: [
      { id: "lane-backlog", name: "Backlog", cards: [] },
      { id: "lane-todo", name: "Todo", cards: [] },
      { id: "lane-in-progress", name: "In Progress", cards: [] },
      { id: "lane-review", name: "Review", cards: [] },
      { id: "lane-done", name: "Done", cards: [] },
    ],
    labels: [],
    nextCardNumber: 1,
    project: { name: "My App", links: [], readmePath: null },
  });
});

test("the name is kept as written, whatever is in it", () => {
  const name = 'cost $5 "q" #x: y';
  expect(starterBoard(name).name).toBe(name);
  expect(starterBoard(name).project.name).toBe(name);
});

test("a starter board survives the store and the dump unchanged", () => {
  const board = starterBoard("My App");
  const database = openDatabase(":memory:");
  const repository = createSqliteBoardRepository(database.db);
  repository.replaceSync(board);
  expect(repository.readSync()).toStrictEqual(board);
  database.close();
  expect(parseDump(serializeDump(board), "x.json")).toStrictEqual(board);
});

test("a board needs a name", () => {
  expect(() => starterBoard("  ")).toThrow(EmptyTitle);
});

test("the sample board uses the same standard lanes", () => {
  expect(seedBoard().lanes.map((lane) => [lane.id, lane.name])).toEqual(STANDARD_LANES);
});
