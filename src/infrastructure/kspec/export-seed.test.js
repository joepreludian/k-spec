// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { seedFiles, writeFiles } from "./export-seed.js";
import { loadBoard } from "./load-board.js";

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kspec-export-"));
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

test("seedFiles adds a stub markdown file for every seed link", () => {
  const files = seedFiles();
  const dir = "lanes/in_progress/3_file_watcher_for_docs_k_spec/files";
  expect(files[`${dir}/board_ui_design.md`]).toBe("# Board UI design\n\nSample data exported from the seed.\n");
  expect(files[`${dir}/board_ui_plan.md`]).toMatch(/^# Board UI plan\n/);
  expect(Object.keys(files).filter((p) => p.includes("/files/"))).toHaveLength(3);
});

test("the written seed loads as a board with its cards and files", async () => {
  const target = path.join(tmp, "kspec-root");
  await writeFiles(target, seedFiles());
  const { status, body } = await loadBoard(target);
  expect(status).toBe(200);
  const cards = body.board.lanes.flatMap((l) => l.cards);
  expect(cards).toHaveLength(8);
  expect(cards.find((c) => c.number === 3).links.map((l) => l.title)).toEqual(["board_ui_design", "board_ui_plan"]);
});

test("writes into an existing empty folder", async () => {
  await writeFiles(tmp, { "board.yaml": "name: X\n" });
  expect(await fs.readFile(path.join(tmp, "board.yaml"), "utf8")).toBe("name: X\n");
});

test("refuses a folder that already has content and leaves it alone", async () => {
  await fs.writeFile(path.join(tmp, "mine.txt"), "keep me");
  await expect(writeFiles(tmp, { "board.yaml": "name: X\n" })).rejects.toThrow(/not empty.*--force/);
  expect(await fs.readdir(tmp)).toEqual(["mine.txt"]);
});

test("force replaces the folder's content", async () => {
  await fs.writeFile(path.join(tmp, "stray.txt"), "old");
  await fs.writeFile(path.join(tmp, "board.yaml"), "name: Old\n");
  await writeFiles(tmp, { "board.yaml": "name: X\n" }, { force: true });
  expect(await fs.readdir(tmp)).toEqual(["board.yaml"]);
});

test("force only replaces a folder that is a kspec root", async () => {
  await fs.writeFile(path.join(tmp, "precious.txt"), "not a board");
  await fs.mkdir(path.join(tmp, "src"));
  await expect(writeFiles(tmp, { "board.yaml": "name: X\n" }, { force: true })).rejects.toThrow(/does not look like a kspec root/);
  expect((await fs.readdir(tmp)).sort()).toEqual(["precious.txt", "src"]);
});
