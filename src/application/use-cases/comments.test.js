import { addComment } from "./add-comment.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { EmptyText, InvalidAuthor } from "@/domain/errors.js";

const initial = addCardToLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  "a",
  createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
);

test("addComment defaults to the person author", async () => {
  const deps = makeDeps(initial);
  const { board, id } = await addComment(deps, { cardId: "c1", body: "Hello" });
  expect(id).toBe("id-1");
  expect(findCard(board, "c1").card.comments).toEqual([
    { id: "id-1", author: { kind: "person", name: "You" }, body: "Hello", createdAt: T0 },
  ]);
});

test("addComment accepts an agent author", async () => {
  const deps = makeDeps(initial);
  const { board } = await addComment(deps, {
    cardId: "c1",
    body: "On it",
    author: { kind: "agent", name: "claude" },
  });
  expect(findCard(board, "c1").card.comments[0].author).toEqual({ kind: "agent", name: "claude" });
});

test("addComment validates body and author", async () => {
  const deps = makeDeps(initial);
  await expect(addComment(deps, { cardId: "c1", body: " " })).rejects.toThrow(EmptyText);
  await expect(
    addComment(deps, { cardId: "c1", body: "x", author: { kind: "bot", name: "x" } }),
  ).rejects.toThrow(InvalidAuthor);
});
