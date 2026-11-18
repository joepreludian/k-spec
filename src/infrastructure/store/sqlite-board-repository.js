import { asc } from "drizzle-orm";
import * as t from "./schema.js";

const CHUNK = 500; // rows per insert statement, well under SQLite's bound-parameter limit

function insertAll(tx, table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) tx.insert(table).values(rows.slice(i, i + CHUNK)).run();
}

/** Rows of `table` in stored order, grouped by `key`. */
function grouped(db, table, key, order = table.position) {
  const groups = new Map();
  for (const row of db.select().from(table).orderBy(asc(order)).all()) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return (id) => groups.get(id) ?? [];
}

// --- reading ---------------------------------------------------------------

function readBoard(db) {
  const [row] = db.select().from(t.board).all();
  if (!row) throw new Error("No board stored");

  const labelsOf = grouped(db, t.cardLabels, "cardId");
  const checklistsOf = grouped(db, t.checklists, "cardId");
  const itemsOf = grouped(db, t.checklistItems, "checklistId");
  const commentsOf = grouped(db, t.comments, "cardId");
  const linksOf = grouped(db, t.cardLinks, "cardId");
  const worksOf = grouped(db, t.works, "cardId", t.works.historyPosition);
  const servicesOf = grouped(db, t.services, "workRowId");
  const eventsOf = grouped(db, t.events, "cardId");
  const cardsOf = grouped(db, t.cards, "laneId");

  const toWork = (w) => ({
    location: w.location,
    branch: w.branch,
    worktreePath: w.worktreePath,
    startedAt: w.startedAt,
    session: w.session,
    services: servicesOf(w.rowId).map(({ id, title, url }) => ({ id, title, url })),
    ...(w.historyPosition === null ? {} : { endedAt: w.endedAt }),
  });

  const toCard = (c) => {
    const works = worksOf(c.id);
    const active = works.find((w) => w.historyPosition === null);
    return {
      id: c.id,
      number: c.number,
      title: c.title,
      description: c.description,
      labelIds: labelsOf(c.id).map((l) => l.labelId),
      agentStatus: c.agentStatus,
      checklists: checklistsOf(c.id).map((k) => ({
        id: k.id,
        title: k.title,
        items: itemsOf(k.id).map(({ id, text, done }) => ({ id, text, done })),
      })),
      comments: commentsOf(c.id).map((m) => ({
        id: m.id,
        author: { kind: m.authorKind, name: m.authorName },
        body: m.body,
        createdAt: m.createdAt,
      })),
      links: linksOf(c.id).map(({ id, title, path }) => ({ id, title, path })),
      work: active ? toWork(active) : null,
      workHistory: works.filter((w) => w.historyPosition !== null).map(toWork),
      events: eventsOf(c.id).map((e) => ({ type: e.type, ...e.data, at: e.at })),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  };

  const ordered = (table) => db.select().from(table).orderBy(asc(table.position)).all();

  return {
    id: row.id,
    name: row.name,
    lanes: ordered(t.lanes).map((l) => ({ id: l.id, name: l.name, cards: cardsOf(l.id).map(toCard) })),
    labels: ordered(t.labels).map(({ id, name, color }) => ({ id, name, color })),
    nextCardNumber: row.nextCardNumber,
    project: {
      name: row.projectName,
      links: ordered(t.projectLinks).map(({ id, title, url }) => ({ id, title, url })),
      readmePath: row.projectReadmePath,
    },
  };
}

// --- writing ---------------------------------------------------------------

const CHILD_FIRST = [
  t.services,
  t.works,
  t.events,
  t.cardLinks,
  t.comments,
  t.checklistItems,
  t.checklists,
  t.cardLabels,
  t.cards,
  t.labels,
  t.lanes,
  t.projectLinks,
  t.board,
];

const positioned = (list, toRow) => list.map((item, position) => ({ ...toRow(item), position }));

function insertWork(tx, cardId, work, historyPosition) {
  const { lastInsertRowid } = tx
    .insert(t.works)
    .values({
      cardId,
      historyPosition,
      location: work.location,
      branch: work.branch,
      worktreePath: work.worktreePath,
      startedAt: work.startedAt,
      endedAt: work.endedAt ?? null,
      session: work.session,
    })
    .run();
  const workRowId = Number(lastInsertRowid);
  insertAll(tx, t.services, positioned(work.services, ({ id, title, url }) => ({ id, workRowId, title, url })));
}

function insertCard(tx, laneId, card, position) {
  const cardId = card.id;
  tx.insert(t.cards)
    .values({
      id: cardId,
      number: card.number,
      laneId,
      position,
      title: card.title,
      description: card.description,
      agentStatus: card.agentStatus,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })
    .run();
  insertAll(tx, t.cardLabels, positioned(card.labelIds, (labelId) => ({ cardId, labelId })));
  insertAll(tx, t.checklists, positioned(card.checklists, ({ id, title }) => ({ id, cardId, title })));
  for (const checklist of card.checklists) {
    insertAll(
      tx,
      t.checklistItems,
      positioned(checklist.items, ({ id, text, done }) => ({ id, checklistId: checklist.id, text, done })),
    );
  }
  insertAll(
    tx,
    t.comments,
    positioned(card.comments, (m) => ({
      id: m.id,
      cardId,
      authorKind: m.author.kind,
      authorName: m.author.name,
      body: m.body,
      createdAt: m.createdAt,
    })),
  );
  insertAll(tx, t.cardLinks, positioned(card.links, ({ id, title, path }) => ({ id, cardId, title, path })));
  card.workHistory.forEach((work, index) => insertWork(tx, cardId, work, index));
  if (card.work) insertWork(tx, cardId, card.work, null);
  insertAll(
    tx,
    t.events,
    positioned(card.events, ({ type, at, ...data }) => ({ cardId, type, at, data })),
  );
}

function writeBoard(tx, board, version) {
  for (const table of CHILD_FIRST) tx.delete(table).run();
  tx.insert(t.board)
    .values({
      id: board.id,
      name: board.name,
      nextCardNumber: board.nextCardNumber,
      projectName: board.project.name,
      projectReadmePath: board.project.readmePath,
      version,
    })
    .run();
  insertAll(tx, t.projectLinks, positioned(board.project.links, ({ id, title, url }) => ({ id, title, url })));
  insertAll(tx, t.labels, positioned(board.labels, ({ id, name, color }) => ({ id, name, color })));
  insertAll(tx, t.lanes, positioned(board.lanes, ({ id, name }) => ({ id, name })));
  for (const lane of board.lanes) lane.cards.forEach((card, position) => insertCard(tx, lane.id, card, position));
}

/**
 * The BoardRepository port on SQLite. The whole board is read and written at once:
 * `save` replaces every row in one transaction and adds 1 to the version, so a failed
 * save leaves the previous board. SQLite access is synchronous; `readSync` / `replaceSync`
 * are the same operations for callers that cannot await (the shutdown dump).
 */
export function createSqliteBoardRepository(db) {
  const version = () => db.select({ version: t.board.version }).from(t.board).all()[0]?.version ?? 0;
  const readSync = () => readBoard(db);
  const replaceSync = (board) => {
    db.transaction((tx) => writeBoard(tx, board, version() + 1));
  };
  return {
    load: async () => readSync(),
    save: async (board) => replaceSync(board),
    version,
    isEmpty: () => db.select({ id: t.board.id }).from(t.board).all().length === 0,
    readSync,
    replaceSync,
  };
}
