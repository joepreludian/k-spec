// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { kspecRoot } from "./kspec-root.js";
import { loadBoard } from "./load-board.js";
import { readTree } from "./read-tree.js";
import { kspecVersion } from "./version.js";

let root;
const write = async (relative, content) => {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kspec-"));
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe("kspecRoot", () => {
  const saved = process.env.K_SPEC_ROOT;
  afterEach(() => {
    if (saved === undefined) delete process.env.K_SPEC_ROOT;
    else process.env.K_SPEC_ROOT = saved;
  });

  test("defaults to kspec-root in the working directory", () => {
    delete process.env.K_SPEC_ROOT;
    expect(kspecRoot()).toBe(path.join(process.cwd(), "kspec-root"));
  });

  test("K_SPEC_ROOT overrides it", () => {
    process.env.K_SPEC_ROOT = "/kspec-root";
    expect(kspecRoot()).toBe("/kspec-root");
  });
});

describe("readTree", () => {
  test("a missing root is an empty tree", async () => {
    expect(await readTree(path.join(root, "nope"))).toEqual({ boardYaml: null, lanes: {} });
  });

  test("a root without lanes/ still gives board.yaml", async () => {
    await write("board.yaml", "name: X\n");
    expect(await readTree(root)).toEqual({ boardYaml: "name: X\n", lanes: {} });
  });

  test("reads lanes, card folders, card.yaml and the files directly in files/", async () => {
    await write("lanes/todo/cards.yaml", "order: [3]\n");
    await write("lanes/todo/3_watcher/card.yaml", "title: Watcher\n");
    await write("lanes/todo/3_watcher/files/design.md", "# d");
    await write("lanes/todo/3_watcher/files/sub/deep.md", "# deep");
    await write("lanes/todo/notes/readme.md", "not a card");
    await write("lanes/todo/5_empty/.keep", "");
    await write("lanes/stray.txt", "x");
    await fs.mkdir(path.join(root, "lanes/done"), { recursive: true });

    const tree = await readTree(root);
    expect(Object.keys(tree.lanes).sort()).toEqual(["done", "todo"]);
    expect(tree.lanes.done).toEqual({ cardsYaml: null, cards: [] });
    expect(tree.lanes.todo.cardsYaml).toBe("order: [3]\n");
    const cards = [...tree.lanes.todo.cards].sort((a, b) => a.dir.localeCompare(b.dir));
    expect(cards.map((c) => c.dir)).toEqual(["3_watcher", "5_empty"]);
    expect(cards[0].cardYaml).toBe("title: Watcher\n");
    expect(cards[0].files).toEqual(["design.md"]);
    expect(cards[0].modifiedAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    expect(cards[1]).toMatchObject({ cardYaml: null, files: [] });
  });
});

describe("kspecVersion", () => {
  test("a missing root has a fixed version", async () => {
    expect(await kspecVersion(path.join(root, "nope"))).toBe("empty");
  });

  test("is stable, and changes when a file is edited, added or removed", async () => {
    await write("board.yaml", "name: X\n");
    await write("lanes/todo/1_a/card.yaml", "title: A\n");
    const first = await kspecVersion(root);
    expect(await kspecVersion(root)).toBe(first);

    await write("lanes/todo/1_a/card.yaml", "title: A much longer title\n");
    const edited = await kspecVersion(root);
    expect(edited).not.toBe(first);

    await write("lanes/todo/1_a/files/x.md", "# x");
    const added = await kspecVersion(root);
    expect(added).not.toBe(edited);

    await fs.rm(path.join(root, "lanes/todo/1_a/files/x.md"));
    expect(await kspecVersion(root)).not.toBe(added);
  });

  test("changes when a card folder moves to another lane", async () => {
    await write("lanes/todo/1_a/card.yaml", "title: A\n");
    const before = await kspecVersion(root);
    await fs.mkdir(path.join(root, "lanes/done"), { recursive: true });
    await fs.rename(path.join(root, "lanes/todo/1_a"), path.join(root, "lanes/done/1_a"));
    expect(await kspecVersion(root)).not.toBe(before);
  });
});

describe("loadBoard", () => {
  test("200 with the board and its version", async () => {
    await write("board.yaml", "name: Loaded\n");
    await write("lanes/todo/1_a/card.yaml", "title: A\n");
    const result = await loadBoard(root);
    expect(result.status).toBe(200);
    expect(result.body.board.name).toBe("Loaded");
    expect(result.body.board.lanes[1].cards[0].title).toBe("A");
    expect(result.body.version).toBe(await kspecVersion(root));
  });

  test("a missing root loads as the five empty lanes", async () => {
    const result = await loadBoard(path.join(root, "nope"));
    expect(result.status).toBe(200);
    expect(result.body.board.lanes).toHaveLength(5);
    expect(result.body.version).toBe("empty");
  });

  test("422 naming the broken file, with the version that was tried", async () => {
    await write("lanes/todo/1_a/card.yaml", "title: [broken\n");
    const result = await loadBoard(root);
    expect(result.status).toBe(422);
    expect(result.body.file).toBe("lanes/todo/1_a/card.yaml");
    expect(result.body.error).toMatch(/yaml/i);
    expect(result.body.version).toBe(await kspecVersion(root));
  });
});
