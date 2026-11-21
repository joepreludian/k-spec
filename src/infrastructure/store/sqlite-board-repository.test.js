// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
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

test("a snapshot is the board together with the version that produced it", async () => {
  await repository.save(seedBoard());
  await repository.save({ ...seedBoard(), name: "Second" });
  const snapshot = repository.snapshotSync();
  expect(snapshot.version).toBe(2);
  expect(snapshot.board).toStrictEqual({ ...seedBoard(), name: "Second" });
});

test("reads see one moment of the database and writes take the write lock up front", async () => {
  // Another process (npm run db:load) can write between statements; a transaction keeps a
  // read on one state, and an immediate one keeps a save from failing half-way on a stale read.
  await repository.save(seedBoard());
  const transaction = vi.spyOn(opened.db, "transaction");
  repository.readSync();
  expect(transaction).toHaveBeenCalledTimes(1);
  repository.snapshotSync();
  expect(transaction).toHaveBeenCalledTimes(2);
  repository.replaceSync(seedBoard());
  expect(transaction).toHaveBeenCalledTimes(3);
  expect(transaction.mock.calls[2][1]).toEqual({ behavior: "immediate" });
});

test("a request and its answer come back exactly as saved", async () => {
  await repository.save(seedBoard());
  const card = (await repository.load()).lanes.flatMap((l) => l.cards)[0];
  await run("addComment", { cardId: card.id, body: "Plan this", request: true });
  await run("addComment", { cardId: card.id, body: "a note" });
  const { board: expected } = await run("addComment", {
    cardId: card.id,
    body: "done",
    author: { kind: "agent", name: "Claude" },
  });
  const board = await repository.load();
  expect(board).toStrictEqual(expected);
  const comments = board.lanes.flatMap((l) => l.cards).find((c) => c.id === card.id).comments.slice(-3);
  expect(comments.map((m) => Object.hasOwn(m, "request"))).toEqual([true, false, false]);
});

test("a database from before requests opens with ordinary comments", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-old-"));
  // The first migration alone: the database as it was before requests existed.
  const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
  const [first] = journal.entries;
  fs.mkdirSync(path.join(dir, "old", "meta"), { recursive: true });
  fs.copyFileSync(`drizzle/${first.tag}.sql`, path.join(dir, "old", `${first.tag}.sql`));
  fs.writeFileSync(path.join(dir, "old", "meta", "_journal.json"), JSON.stringify({ ...journal, entries: [first] }));
  const file = path.join(dir, "board.db");
  const old = new Database(file);
  migrate(drizzle(old), { migrationsFolder: path.join(dir, "old") });
  old.exec(`
    insert into board (id, name, next_card_number, project_name, version) values ('b', 'Old', 2, 'Old', 3);
    insert into lanes (id, name, position) values ('lane', 'Lane', 0);
    insert into cards (id, number, lane_id, position, title, description, agent_status, created_at, updated_at)
      values ('c1', 1, 'lane', 0, 'Card', '', 'idle', '${T0}', '${T0}');
    insert into comments (id, card_id, position, author_kind, author_name, body, created_at)
      values ('m1', 'c1', 0, 'person', 'You', 'from before', '${T0}');
  `);
  old.close();

  const now = openDatabase(file);
  const reopened = createSqliteBoardRepository(now.db);
  const before = await reopened.load();
  expect(before.lanes[0].cards[0].comments).toStrictEqual([
    { id: "m1", author: { kind: "person", name: "You" }, body: "from before", createdAt: T0 },
  ]);
  expect(reopened.version()).toBe(3);
  await COMMANDS.addComment({ ...deps, repository: reopened }, { cardId: "c1", body: "Plan this", request: true });
  expect((await reopened.load()).lanes[0].cards[0].comments.map((m) => m.request)).toEqual([undefined, true]);
  now.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the first board's version comes from firstVersion, every later one adds 1", async () => {
  expect(repository.version()).toBe(0);
  repository.replaceSync(seedBoard());
  expect(repository.version()).toBe(1);

  const other = openDatabase(":memory:");
  const clocked = createSqliteBoardRepository(other.db, { firstVersion: () => 1763600000000 });
  clocked.replaceSync(seedBoard());
  expect(clocked.version()).toBe(1763600000000);
  await clocked.save(seedBoard());
  expect(clocked.version()).toBe(1763600000001);
  other.close();
});
