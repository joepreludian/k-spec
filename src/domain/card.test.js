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
} from "./card.js";
import { PERSON } from "./author.js";
import {
  EmptyTitle,
  EmptyText,
  InvalidAgentStatus,
  InvalidAuthor,
  ChecklistNotFound,
  ChecklistItemNotFound,
} from "./errors.js";

const T0 = "2026-11-14T10:00:00.000Z";
const T1 = "2026-11-14T10:05:00.000Z";

const base = () => createCard({ id: "c1", title: "Spec", now: T0 });
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
    title: "Spec",
    description: "",
    labelIds: [],
    agentStatus: "idle",
    checklists: [],
    comments: [],
    createdAt: T0,
    updatedAt: T0,
  });
});

test("createCard trims and rejects blank title", () => {
  expect(createCard({ id: "c1", title: "  Spec ", now: T0 }).title).toBe("Spec");
  expect(() => createCard({ id: "c1", title: "  ", now: T0 })).toThrow(EmptyTitle);
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
