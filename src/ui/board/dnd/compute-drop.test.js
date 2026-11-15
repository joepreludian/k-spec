import { computeCardDrop, computeLaneDrop, parseDragId } from "./compute-drop.js";
import { createBoard, addLane, addCardToLane } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";

const T = "2026-11-14T10:00:00.000Z";
let b = addLane(addLane(createBoard({ id: "x", name: "B" }), { id: "a", name: "A" }), { id: "b", name: "B" });
for (const [i, id] of ["c1", "c2", "c3"].entries()) b = addCardToLane(b, "a", createCard({ id, number: i + 1, title: id, now: T }));
b = addCardToLane(b, "b", createCard({ id: "c4", number: 4, title: "c4", now: T }));

test("parseDragId splits kind and id", () => {
  expect(parseDragId("card:c1")).toEqual({ kind: "card", id: "c1" });
  expect(parseDragId("lane:lane-todo")).toEqual({ kind: "lane", id: "lane-todo" });
  expect(parseDragId("nope")).toBeNull();
});

test("over a card in another lane inserts before it", () => {
  expect(computeCardDrop(b, { activeId: "card:c1", overId: "card:c4" })).toEqual({ cardId: "c1", toLaneId: "b", position: 0 });
});

test("over a lane appends", () => {
  expect(computeCardDrop(b, { activeId: "card:c1", overId: "lane:b" })).toEqual({ cardId: "c1", toLaneId: "b", position: 1 });
});

test("reorder within lane downward lands after the hovered card", () => {
  expect(computeCardDrop(b, { activeId: "card:c1", overId: "card:c3" })).toEqual({ cardId: "c1", toLaneId: "a", position: 2 });
});

test("reorder within lane upward lands at the hovered index", () => {
  expect(computeCardDrop(b, { activeId: "card:c3", overId: "card:c1" })).toEqual({ cardId: "c3", toLaneId: "a", position: 0 });
});

test("same position or self returns null", () => {
  expect(computeCardDrop(b, { activeId: "card:c1", overId: "card:c1" })).toBeNull();
  expect(computeCardDrop(b, { activeId: "card:c3", overId: "lane:a" })).toBeNull();
  expect(computeCardDrop(b, { activeId: "card:c1", overId: null })).toBeNull();
});

test("non-card active or unknown targets return null", () => {
  expect(computeCardDrop(b, { activeId: "lane:a", overId: "card:c1" })).toBeNull();
  expect(computeCardDrop(b, { activeId: "card:zz", overId: "card:c1" })).toBeNull();
  expect(computeCardDrop(b, { activeId: "card:c1", overId: "card:zz" })).toBeNull();
});

test("lane reorder", () => {
  expect(computeLaneDrop(b, { activeId: "lane:a", overId: "lane:b" })).toEqual({ laneIds: ["b", "a"] });
  expect(computeLaneDrop(b, { activeId: "lane:a", overId: "lane:a" })).toBeNull();
  expect(computeLaneDrop(b, { activeId: "card:c1", overId: "lane:b" })).toBeNull();
  expect(computeLaneDrop(b, { activeId: "lane:a", overId: "card:c4" })).toBeNull();
});
