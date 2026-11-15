import { createLabel } from "./create-label.js";
import { updateLabel } from "./update-label.js";
import { deleteLabel } from "./delete-label.js";
import { addLabel } from "./add-label.js";
import { removeLabel } from "./remove-label.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard, createLabel as newLabel } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { DuplicateLabelName, LabelNotFound } from "@/domain/errors.js";

const initial = newLabel(
  addCardToLane(
    addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
    "a",
    createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
  ),
  { id: "l1", name: "bug", color: "red" },
);
let deps;
beforeEach(() => {
  deps = makeDeps(initial);
});

test("createLabel appends with generated id", async () => {
  const { board, id } = await createLabel(deps, { name: "ui", color: "teal" });
  expect(id).toBe("id-1");
  expect(board.labels.at(-1)).toEqual({ id: "id-1", name: "ui", color: "teal" });
  await expect(createLabel(deps, { name: "BUG", color: "red" })).rejects.toThrow(DuplicateLabelName);
});

test("updateLabel persists", async () => {
  const { board } = await updateLabel(deps, { labelId: "l1", name: "defect", color: "orange" });
  expect(board.labels[0]).toEqual({ id: "l1", name: "defect", color: "orange" });
  expect((await deps.repository.load()).labels[0].name).toBe("defect");
});

test("addLabel / removeLabel on card", async () => {
  let { board } = await addLabel(deps, { cardId: "c1", labelId: "l1" });
  expect(findCard(board, "c1").card.labelIds).toEqual(["l1"]);
  expect(findCard(board, "c1").card.updatedAt).toBe(T0);
  await expect(addLabel(deps, { cardId: "c1", labelId: "zz" })).rejects.toThrow(LabelNotFound);
  ({ board } = await removeLabel(deps, { cardId: "c1", labelId: "l1" }));
  expect(findCard(board, "c1").card.labelIds).toEqual([]);
});

test("deleteLabel detaches from cards", async () => {
  await addLabel(deps, { cardId: "c1", labelId: "l1" });
  const { board } = await deleteLabel(deps, { labelId: "l1" });
  expect(board.labels).toEqual([]);
  expect(findCard(board, "c1").card.labelIds).toEqual([]);
});
