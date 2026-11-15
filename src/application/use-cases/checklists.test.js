import { addChecklist } from "./add-checklist.js";
import { removeChecklist } from "./remove-checklist.js";
import { addChecklistItem } from "./add-checklist-item.js";
import { toggleChecklistItem } from "./toggle-checklist-item.js";
import { removeChecklistItem } from "./remove-checklist-item.js";
import { makeDeps } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { EmptyText } from "@/domain/errors.js";

const initial = addCardToLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  "a",
  createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
);
const card = (b) => findCard(b, "c1").card;

test("checklist lifecycle through use cases", async () => {
  const deps = makeDeps(initial);
  let r = await addChecklist(deps, { cardId: "c1", title: "Acceptance" });
  expect(r.id).toBe("id-1");
  expect(card(r.board).checklists).toEqual([{ id: "id-1", title: "Acceptance", items: [] }]);

  r = await addChecklistItem(deps, { cardId: "c1", checklistId: "id-1", text: "one" });
  expect(r.id).toBe("id-2");
  expect(card(r.board).checklists[0].items).toEqual([{ id: "id-2", text: "one", done: false }]);

  r = await toggleChecklistItem(deps, { cardId: "c1", checklistId: "id-1", itemId: "id-2" });
  expect(card(r.board).checklists[0].items[0].done).toBe(true);

  r = await removeChecklistItem(deps, { cardId: "c1", checklistId: "id-1", itemId: "id-2" });
  expect(card(r.board).checklists[0].items).toEqual([]);

  r = await removeChecklist(deps, { cardId: "c1", checklistId: "id-1" });
  expect(card(r.board).checklists).toEqual([]);
  expect(card(await deps.repository.load()).checklists).toEqual([]);
});

test("blank item text rejected", async () => {
  const deps = makeDeps(initial);
  await addChecklist(deps, { cardId: "c1", title: "A" });
  await expect(
    addChecklistItem(deps, { cardId: "c1", checklistId: "id-1", text: "  " }),
  ).rejects.toThrow(EmptyText);
});
