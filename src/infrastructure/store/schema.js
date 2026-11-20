import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The board as tables. Anything the domain gives an id is a row keyed by that id; ordered
// children carry a `position`; value objects without identity are JSON text.
// No `@/` imports here: drizzle-kit loads this file directly.

const position = () => integer("position").notNull();
const cascade = { onDelete: "cascade" };

export const board = sqliteTable("board", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nextCardNumber: integer("next_card_number").notNull(),
  projectName: text("project_name").notNull(),
  projectReadmePath: text("project_readme_path"),
  version: integer("version").notNull().default(0),
});

export const projectLinks = sqliteTable("project_links", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  position: position(),
});

export const lanes = sqliteTable("lanes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: position(),
});

export const labels = sqliteTable("labels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  position: position(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique(),
  laneId: text("lane_id")
    .notNull()
    .references(() => lanes.id, cascade),
  position: position(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  agentStatus: text("agent_status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

const cardId = () =>
  text("card_id")
    .notNull()
    .references(() => cards.id, cascade);

export const cardLabels = sqliteTable(
  "card_labels",
  {
    cardId: cardId(),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, cascade),
    position: position(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

export const checklists = sqliteTable("checklists", {
  id: text("id").primaryKey(),
  cardId: cardId(),
  position: position(),
  title: text("title").notNull(),
});

export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id")
    .notNull()
    .references(() => checklists.id, cascade),
  position: position(),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull(),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  cardId: cardId(),
  position: position(),
  authorKind: text("author_kind").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  // A request to the agent. The board only carries the mark on requests; here it is a plain flag.
  request: integer("request", { mode: "boolean" }).notNull().default(false),
});

export const cardLinks = sqliteTable("card_links", {
  id: text("id").primaryKey(),
  cardId: cardId(),
  position: position(),
  title: text("title").notNull(),
  path: text("path").notNull(),
});

/** A work block has no domain id; `rowId` is private to the store. `historyPosition` null = the active work. */
export const works = sqliteTable("works", {
  rowId: integer("row_id").primaryKey({ autoIncrement: true }),
  cardId: cardId(),
  historyPosition: integer("history_position"),
  location: text("location", { mode: "json" }).notNull(),
  branch: text("branch").notNull(),
  worktreePath: text("worktree_path"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  session: text("session", { mode: "json" }),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  workRowId: integer("work_row_id")
    .notNull()
    .references(() => works.rowId, cascade),
  position: position(),
  title: text("title").notNull(),
  url: text("url").notNull(),
});

/** Activity entries: `type` and `at` are columns, the type-specific rest is `data`. */
export const events = sqliteTable("events", {
  rowId: integer("row_id").primaryKey({ autoIncrement: true }),
  cardId: cardId(),
  position: position(),
  type: text("type").notNull(),
  at: text("at").notNull(),
  data: text("data", { mode: "json" }).notNull(),
});
