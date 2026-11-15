import {
  createCard,
  renameCard,
  updateDescription,
  addLabelToCard,
  removeLabelFromCard,
  setAgentStatus,
  addChecklist,
  removeChecklist,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  addComment,
  checklistProgress,
  cardProgress,
  checklistSummaries,
  addLink,
  removeLink,
  startWork,
  updateWorkSession,
  endWork,
} from "./card.js";
import { PERSON } from "./author.js";
import {
  EmptyTitle,
  EmptyText,
  InvalidAgentStatus,
  InvalidAuthor,
  ChecklistNotFound,
  ChecklistItemNotFound,
  InvalidCardNumber,
  InvalidLinkPath,
  DuplicateLink,
  LinkNotFound,
  NoActiveWork,
} from "./errors.js";

const T0 = "2026-11-14T10:00:00.000Z";
const T1 = "2026-11-14T10:05:00.000Z";

const base = () => createCard({ id: "c1", number: 1, title: "Spec", now: T0 });
const withList = () => addChecklist(base(), { id: "k1", title: "Acceptance" }, T0);
const withItems = () =>
  addChecklistItem(
    addChecklistItem(withList(), "k1", { id: "i1", text: "one" }, T0),
    "k1",
    { id: "i2", text: "two" },
    T0,
  );

test("createCard sets defaults", () => {
  expect(base()).toEqual({
    id: "c1",
    number: 1,
    title: "Spec",
    description: "",
    labelIds: [],
    agentStatus: "idle",
    checklists: [],
    comments: [],
    links: [],
    work: null,
    workHistory: [],
    events: [],
    createdAt: T0,
    updatedAt: T0,
  });
});

test("createCard trims and rejects blank title", () => {
  expect(createCard({ id: "c1", number: 1, title: "  Spec ", now: T0 }).title).toBe("Spec");
  expect(() => createCard({ id: "c1", number: 1, title: "  ", now: T0 })).toThrow(EmptyTitle);
});

test("createCard requires a positive integer number", () => {
  expect(base().number).toBe(1);
  for (const number of [0, -1, 1.5, "1", undefined])
    expect(() => createCard({ id: "c1", number, title: "Spec", now: T0 })).toThrow(InvalidCardNumber);
});

test("mutators return new objects and bump updatedAt", () => {
  const c = base();
  const r = renameCard(c, "New", T1);
  expect(r).not.toBe(c);
  expect(c.title).toBe("Spec");
  expect(r.title).toBe("New");
  expect(r.updatedAt).toBe(T1);
  expect(r.createdAt).toBe(T0);
});

test("renameCard rejects blank", () => {
  expect(() => renameCard(base(), " ", T1)).toThrow(EmptyTitle);
});

test("updateDescription accepts any string including empty", () => {
  const c = updateDescription(base(), "# Goal", T1);
  expect(c.description).toBe("# Goal");
  expect(updateDescription(c, "", T1).description).toBe("");
});

test("addLabelToCard is idempotent and removeLabelFromCard removes", () => {
  const c = addLabelToCard(addLabelToCard(base(), "l1", T1), "l1", T1);
  expect(c.labelIds).toEqual(["l1"]);
  expect(removeLabelFromCard(c, "l1", T1).labelIds).toEqual([]);
  expect(removeLabelFromCard(c, "nope", T1).labelIds).toEqual(["l1"]);
});

test("setAgentStatus sets and validates", () => {
  expect(setAgentStatus(base(), "working", T1).agentStatus).toBe("working");
  expect(() => setAgentStatus(base(), "nope", T1)).toThrow(InvalidAgentStatus);
});

test("addChecklist creates an empty checklist", () => {
  expect(withList().checklists).toEqual([{ id: "k1", title: "Acceptance", items: [] }]);
});

test("checklist title and item text must be non-empty", () => {
  expect(() => addChecklist(base(), { id: "k", title: " " }, T0)).toThrow(EmptyTitle);
  expect(() =>
    addChecklistItem(withList(), "k1", { id: "i", text: " " }, T1),
  ).toThrow(EmptyText);
});

test("checklist item lifecycle and progress", () => {
  let c = withItems();
  expect(checklistProgress(c.checklists[0])).toEqual({ done: 0, total: 2 });
  c = toggleChecklistItem(c, "k1", "i1", T1);
  expect(c.checklists[0].items[0].done).toBe(true);
  expect(checklistProgress(c.checklists[0])).toEqual({ done: 1, total: 2 });
  c = toggleChecklistItem(c, "k1", "i1", T1);
  expect(c.checklists[0].items[0].done).toBe(false);
  c = removeChecklistItem(c, "k1", "i2", T1);
  expect(c.checklists[0].items.map((i) => i.id)).toEqual(["i1"]);
  c = removeChecklist(c, "k1", T1);
  expect(c.checklists).toEqual([]);
});

test("checklist errors", () => {
  expect(() =>
    addChecklistItem(base(), "missing", { id: "i", text: "x" }, T1),
  ).toThrow(ChecklistNotFound);
  expect(() => toggleChecklistItem(withList(), "k1", "missing", T1)).toThrow(
    ChecklistItemNotFound,
  );
  expect(() => removeChecklist(base(), "missing", T1)).toThrow(ChecklistNotFound);
  expect(() => removeChecklistItem(withList(), "k1", "missing", T1)).toThrow(
    ChecklistItemNotFound,
  );
});

test("cardProgress sums checklists", () => {
  let c = withItems();
  c = addChecklist(c, { id: "k2", title: "QA" }, T0);
  c = addChecklistItem(c, "k2", { id: "i3", text: "three" }, T0);
  c = toggleChecklistItem(c, "k2", "i3", T1);
  expect(cardProgress(c)).toEqual({ done: 1, total: 3 });
  expect(cardProgress(base())).toEqual({ done: 0, total: 0 });
});

test("addComment appends with createdAt", () => {
  const c = addComment(base(), { id: "m1", author: PERSON, body: " Hello " }, T1);
  expect(c.comments).toEqual([
    { id: "m1", author: { kind: "person", name: "You" }, body: "Hello", createdAt: T1 },
  ]);
  expect(c.updatedAt).toBe(T1);
});

test("addComment validates body and author", () => {
  expect(() => addComment(base(), { id: "m", author: PERSON, body: " " }, T1)).toThrow(
    EmptyText,
  );
  expect(() =>
    addComment(base(), { id: "m", author: { kind: "bot", name: "x" }, body: "hi" }, T1),
  ).toThrow(InvalidAuthor);
});

test("addLink appends and bumps updatedAt", () => {
  const c = addLink(base(), { id: "l1", title: " Design ", path: "docs/a.md" }, T1);
  expect(c.links).toEqual([{ id: "l1", title: "Design", path: "docs/a.md" }]);
  expect(c.updatedAt).toBe(T1);
});

test("addLink rejects empty title, bad path and duplicate path", () => {
  const c = addLink(base(), { id: "l1", title: "Design", path: "docs/a.md" }, T0);
  expect(() => addLink(c, { id: "l2", title: " ", path: "docs/b.md" }, T0)).toThrow(EmptyTitle);
  expect(() => addLink(c, { id: "l2", title: "x", path: "../b.md" }, T0)).toThrow(InvalidLinkPath);
  expect(() => addLink(c, { id: "l2", title: "x", path: "docs/a.md" }, T0)).toThrow(DuplicateLink);
});

test("removeLink removes or throws LinkNotFound", () => {
  const c = addLink(base(), { id: "l1", title: "Design", path: "docs/a.md" }, T0);
  expect(removeLink(c, "l1", T1).links).toEqual([]);
  expect(removeLink(c, "l1", T1).updatedAt).toBe(T1);
  expect(() => removeLink(c, "nope", T1)).toThrow(LinkNotFound);
});

const loc = { kind: "lima", name: "lima-dev-k-spec-watcher" };
const session = {
  id: "s1",
  model: "claude-fable-5-1",
  tokens: { input: 10, output: 2, cached: 3 },
  turns: 1,
  lastTool: null,
  lastActivityAt: T0,
};

test("startWork sets work and records an event", () => {
  const c = startWork(base(), { location: loc, branch: "feat/x" }, T1);
  expect(c.work).toEqual({ location: loc, branch: "feat/x", worktreePath: null, startedAt: T1, session: null, services: [] });
  expect(c.events).toEqual([{ type: "work-started", location: loc, branch: "feat/x", at: T1 }]);
  expect(c.updatedAt).toBe(T1);
});

test("startWork over active work archives it with endedAt and two events", () => {
  const first = startWork(base(), { location: { kind: "host", name: "mbp" }, branch: "main" }, T0);
  const c = startWork(first, { location: loc, branch: "feat/x" }, T1);
  expect(c.workHistory).toEqual([{ ...first.work, endedAt: T1 }]);
  expect(c.events.map((e) => e.type)).toEqual(["work-started", "work-ended", "work-started"]);
  expect(c.events[1]).toEqual({ type: "work-ended", location: { kind: "host", name: "mbp" }, branch: "main", at: T1 });
});

test("updateWorkSession replaces the session, defaults lastActivityAt, and does not touch updatedAt or events", () => {
  const active = startWork(base(), { location: loc, branch: "feat/x" }, T0);
  const { lastActivityAt: _omit, ...noStamp } = session;
  const c = updateWorkSession(active, noStamp, T1);
  expect(c.work.session).toEqual({ ...noStamp, lastActivityAt: T1 });
  expect(c.updatedAt).toBe(T0);
  expect(c.events).toHaveLength(1);
  expect(updateWorkSession(active, session, T1).work.session.lastActivityAt).toBe(T0);
});

test("updateWorkSession and endWork require active work", () => {
  expect(() => updateWorkSession(base(), session, T0)).toThrow(NoActiveWork);
  expect(() => endWork(base(), T0)).toThrow(NoActiveWork);
});

test("endWork archives and records the event", () => {
  const c = endWork(startWork(base(), { location: loc, branch: "feat/x" }, T0), T1);
  expect(c.work).toBeNull();
  expect(c.workHistory[0]).toMatchObject({ branch: "feat/x", startedAt: T0, endedAt: T1 });
  expect(c.events.at(-1)).toEqual({ type: "work-ended", location: loc, branch: "feat/x", at: T1 });
  expect(c.updatedAt).toBe(T1);
});

test("setAgentStatus records a status-changed event only when the status changes", () => {
  const c = setAgentStatus(base(), "working", T1);
  expect(c.events).toEqual([{ type: "status-changed", from: "idle", to: "working", at: T1 }]);
  expect(setAgentStatus(c, "working", T1).events).toHaveLength(1);
});

test("checklistSummaries lists each checklist's progress in order", () => {
  const c = addChecklistItem(addChecklist(withItems(), { id: "k2", title: "Steps" }, T0), "k2", { id: "i3", text: "x" }, T0);
  expect(checklistSummaries(toggleChecklistItem(c, "k2", "i3", T0))).toEqual([
    { id: "k1", title: "Acceptance", done: 0, total: 2 },
    { id: "k2", title: "Steps", done: 1, total: 1 },
  ]);
  expect(checklistSummaries(base())).toEqual([]);
});

test("startWork with a session stamps lastActivityAt when missing", () => {
  const { lastActivityAt: _omit, ...noStamp } = session;
  const c = startWork(base(), { location: loc, branch: "feat/x", session: noStamp }, T1);
  expect(c.work.session.lastActivityAt).toBe(T1);
});
