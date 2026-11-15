import { addCardLink } from "./add-card-link.js";
import { removeCardLink } from "./remove-card-link.js";
import { makeDeps } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { CardNotFound, InvalidLinkPath } from "@/domain/errors.js";

const initial = addCardToLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  "a",
  createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
);
let deps;
beforeEach(() => {
  deps = makeDeps(initial);
});

test("addCardLink defaults the title to the file basename and returns id", async () => {
  const { board, id } = await addCardLink(deps, { cardId: "c1", path: "docs/specs/2026-design.md" });
  expect(id).toBe("id-1");
  expect(findCard(board, "c1").card.links).toEqual([
    { id: "id-1", title: "2026-design", path: "docs/specs/2026-design.md" },
  ]);
  expect(findCard(await deps.repository.load(), "c1").card.links).toHaveLength(1);
});

test("addCardLink keeps an explicit title and treats a blank one as missing", async () => {
  let { board } = await addCardLink(deps, { cardId: "c1", title: "Design", path: "a.md" });
  expect(findCard(board, "c1").card.links[0].title).toBe("Design");
  ({ board } = await addCardLink(deps, { cardId: "c1", title: "  ", path: "b.markdown" }));
  expect(findCard(board, "c1").card.links[1].title).toBe("b");
});

test("removeCardLink removes it", async () => {
  await addCardLink(deps, { cardId: "c1", path: "a.md" });
  const { board } = await removeCardLink(deps, { cardId: "c1", linkId: "id-1" });
  expect(findCard(board, "c1").card.links).toEqual([]);
});

test("unknown card and bad path reject with domain errors", async () => {
  await expect(addCardLink(deps, { cardId: "zz", path: "a.md" })).rejects.toThrow(CardNotFound);
  await expect(addCardLink(deps, { cardId: "c1", path: "a.txt" })).rejects.toThrow(InvalidLinkPath);
});
