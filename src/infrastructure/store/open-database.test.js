// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "./open-database.js";

const TABLES = [
  "board",
  "project_links",
  "lanes",
  "labels",
  "cards",
  "card_labels",
  "checklists",
  "checklist_items",
  "comments",
  "card_links",
  "works",
  "services",
  "events",
];

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-db-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("an opened database has every table", () => {
  const { db, close } = openDatabase(":memory:");
  const names = db.$client.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name);
  expect(names).toEqual(expect.arrayContaining(TABLES));
  close();
});

test("foreign keys are enforced", () => {
  const { db, close } = openDatabase(":memory:");
  expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
  close();
});

test("opening a file database creates its folder, and opening it again is harmless", () => {
  const file = path.join(tmp, "nested", "dir", "x.db");
  openDatabase(file).close();
  expect(fs.existsSync(file)).toBe(true);
  expect(() => openDatabase(file).close()).not.toThrow();
});
