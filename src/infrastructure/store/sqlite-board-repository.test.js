// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { COMMANDS } from "@/application/commands.js";
import { fixedClock } from "@/infrastructure/clock.js";
import { sequentialIdGenerator } from "@/infrastructure/id-generator.js";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { openDatabase } from "./open-database.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

const T0 = "2026-11-14T10:00:00.000Z";

let opened;
let repository;
let deps;
const run = (name, input) => COMMANDS[name](deps, input);
const count = (table) => opened.db.$client.prepare(`select count(*) c from ${table}`).get().c;

beforeEach(() => {
  opened = openDatabase(":memory:");
  repository = createSqliteBoardRepository(opened.db);
  deps = { repository, clock: fixedClock(T0), idGenerator: sequentialIdGenerator("new") };
});
afterEach(() => opened.close());

test("the seed board comes back exactly as it was saved", async () => {
  const seed = seedBoard();
  await repository.save(seed);
  expect(await repository.load()).toStrictEqual(seed);
});

test("an empty database has no board, version 0", async () => {
  expect(repository.isEmpty()).toBe(true);
  expect(repository.version()).toBe(0);
  await expect(repository.load()).rejects.toThrow("No board stored");
  await repository.save(seedBoard());
  expect(repository.isEmpty()).toBe(false);
});

test("every save adds one to the version; loading does not", async () => {
  await repository.save(seedBoard());
  expect(repository.version()).toBe(1);
  await repository.load();
  expect(repository.version()).toBe(1);
  await repository.save(seedBoard());
  expect(repository.version()).toBe(2);
});

test("order is kept for lanes, cards, labels, checklists, items, comments and links", async () => {
  await repository.save(seedBoard());
  const laneId = "lane-backlog";
  const ids = [];
  for (const title of ["one", "two", "three"]) ids.push((await run("createCard", { laneId, title })).id);
  await run("moveCard", { cardId: ids[2], toLaneId: laneId, position: 0 });
  const before = (await repository.load()).lanes.map((l) => l.id);
  await run("reorderLanes", { laneIds: [...before].reverse() });
  const cardId = ids[0];
  const first = (await run("addChecklist", { cardId, title: "A" })).id;
  await run("addChecklist", { cardId, title: "B" });
  await run("addChecklistItem", { cardId, checklistId: first, text: "a1" });
  await run("addChecklistItem", { cardId, checklistId: first, text: "a2" });
  await run("addComment", { cardId, body: "first" });
  await run("addComment", { cardId, body: "second" });
  await run("addCardLink", { cardId, title: "L1", path: "docs/a.md" });
  await run("addCardLink", { cardId, title: "L2", path: "docs/b.md" });
  await run("addLabel", { cardId, labelId: "label-ui" });
  const { board: expected } = await run("addLabel", { cardId, labelId: "label-bug" });

  const board = await repository.load();
  expect(board).toStrictEqual(expected);
  expect(board.lanes.map((l) => l.id)).toEqual([...before].reverse());
  const lane = board.lanes.find((l) => l.id === laneId);
  expect(lane.cards.slice(0, 1).map((c) => c.id)).toEqual([ids[2]]);
  const card = lane.cards.find((c) => c.id === cardId);
  expect(card.labelIds).toEqual(["label-ui", "label-bug"]);
  expect(card.checklists.map((k) => k.title)).toEqual(["A", "B"]);
  expect(card.checklists[0].items.map((i) => i.text)).toEqual(["a1", "a2"]);
  expect(card.comments.map((c) => c.body)).toEqual(["first", "second"]);
  expect(card.links.map((l) => l.title)).toEqual(["L1", "L2"]);
});

test("a save replaces what was stored: removed things are gone", async () => {
  await repository.save(seedBoard());
  const seed = await repository.load();
  const lane = seed.lanes.find((l) => l.cards.some((c) => c.checklists.length > 0));
  const withChecklist = lane.cards.find((c) => c.checklists.length > 0);
  await run("removeChecklist", { cardId: withChecklist.id, checklistId: withChecklist.checklists[0].id });
  const victim = seed.lanes.flatMap((l) => l.cards).find((c) => c.comments.length > 0 && c.id !== withChecklist.id);
  await run("deleteCard", { cardId: victim.id });
  const emptyLane = (await run("createLane", { name: "Temp" })).id;
  const { board: expected } = await run("removeLane", { laneId: emptyLane });

  const board = await repository.load();
  expect(board).toStrictEqual(expected);
  const cards = board.lanes.flatMap((l) => l.cards);
  expect(cards.some((c) => c.id === victim.id)).toBe(false);
  expect(count("cards")).toBe(cards.length);
  expect(count("comments")).toBe(cards.reduce((n, c) => n + c.comments.length, 0));
  expect(count("checklists")).toBe(cards.reduce((n, c) => n + c.checklists.length, 0));
  expect(count("lanes")).toBe(board.lanes.length);
});

test("a save that fails part-way leaves the previous board and version", async () => {
  const seed = seedBoard();
  await repository.save(seed);
  const card = seed.lanes.flatMap((l) => l.cards)[0];
  const broken = { ...seed, name: "Broken", lanes: [{ ...seed.lanes[0], cards: [card, card] }] };
  await expect(repository.save(broken)).rejects.toThrow();
  expect(await repository.load()).toStrictEqual(seed);
  expect(repository.version()).toBe(1);
});

test("unusual but valid boards survive", async () => {
  await repository.save(seedBoard());
  const seed = await repository.load();
  const cards = seed.lanes.flatMap((l) => l.cards);
  const working = cards.find((c) => c.work);
  await run("endWork", { cardId: working.id }); // history, no active work
  const idle = cards.find((c) => !c.work);
  await run("startWork", {
    cardId: idle.id,
    location: { kind: "host", name: "box" },
    branch: "feat/x",
    worktreePath: null,
    session: null,
  });
  await run("updateCardDescription", { cardId: idle.id, description: "línea uno\n\n- ✅ two\n\ttabbed \"quoted\"" });
  await run("createLane", { name: "Empty lane" });
  await run("addLabel", { cardId: idle.id, labelId: "label-cli" });
  const { board: expected } = await run("addLabel", { cardId: working.id, labelId: "label-cli" });

  const board = await repository.load();
  expect(board).toStrictEqual(expected);
  const reloaded = board.lanes.flatMap((l) => l.cards).find((c) => c.id === working.id);
  expect(reloaded.work).toBeNull();
  expect(reloaded.workHistory.at(-1).endedAt).toBe(T0);
});

test("a restarted session with no last tool keeps its null", async () => {
  await repository.save(seedBoard());
  const card = (await repository.load()).lanes.flatMap((l) => l.cards).find((c) => c.work);
  const session = { id: "s-9", model: "m", tokens: { input: 1, output: 2, cached: 0 }, turns: 0, lastTool: null };
  const { board: expected } = await run("updateWorkSession", { cardId: card.id, session });
  expect(await repository.load()).toStrictEqual(expected);
});

test("the board and its version survive closing and reopening the file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-repo-"));
  const file = path.join(dir, "board.db");
  const first = openDatabase(file);
  const seed = seedBoard();
  await createSqliteBoardRepository(first.db).save(seed);
  first.close();
  const second = openDatabase(file);
  const reopened = createSqliteBoardRepository(second.db);
  expect(await reopened.load()).toStrictEqual(seed);
  expect(reopened.version()).toBe(1);
  second.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
