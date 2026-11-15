import {
  createBoard,
  addLane,
  renameLane,
  removeLane,
  reorderLanes,
  findLane,
  addCardToLane,
  findCard,
  updateCard,
  removeCard,
  moveCard,
  createLabel,
  updateLabel,
  deleteLabel,
  findLabel,
  attachLabel,
  detachLabel,
} from "./board.js";
import { createLane } from "./lane.js";
import { createCard } from "./card.js";
import {
  CardNotFound,
  DuplicateLabelName,
  EmptyTitle,
  InvalidLabelColor,
  InvalidLaneOrder,
  LabelNotFound,
  LaneNotEmpty,
  LaneNotFound,
} from "./errors.js";

const T0 = "2026-11-14T10:00:00.000Z";

function boardWith(spec) {
  let b = createBoard({ id: "b", name: "Board" });
  for (const [laneId, cardIds] of Object.entries(spec)) {
    b = addLane(b, { id: laneId, name: laneId.toUpperCase() });
    for (const cardId of cardIds) {
      b = addCardToLane(b, laneId, createCard({ id: cardId, title: cardId, now: T0 }));
    }
  }
  return b;
}
const ids = (b) => b.lanes.map((l) => l.cards.map((c) => c.id));
const allIds = (b) => b.lanes.flatMap((l) => l.cards.map((c) => c.id));

const b = boardWith({ a: ["c1", "c2"], b: ["c3"] });
const withBug = createLabel(b, { id: "l1", name: "bug", color: "red" });
const withBugOnC1AndC3 = attachLabel(attachLabel(withBug, "c1", "l1", T0), "c3", "l1", T0);

test("createBoard is empty", () => {
  expect(createBoard({ id: "b", name: "Board" })).toEqual({ id: "b", name: "Board", lanes: [], labels: [] });
});

test("addLane appends and lane names are validated", () => {
  expect(b.lanes.map((l) => l.name)).toEqual(["A", "B"]);
  expect(() => addLane(b, { id: "c", name: " " })).toThrow(EmptyTitle);
  expect(() => renameLane(b, "a", " ")).toThrow(EmptyTitle);
  expect(renameLane(b, "a", "Alpha").lanes[0].name).toBe("Alpha");
  expect(() => renameLane(b, "zz", "X")).toThrow(LaneNotFound);
});

test("findLane throws when missing", () => {
  expect(findLane(b, "a").id).toBe("a");
  expect(() => findLane(b, "zz")).toThrow(LaneNotFound);
});

test("removeLane refuses non-empty lane", () => {
  expect(() => removeLane(b, "a")).toThrow(LaneNotEmpty);
});

test("removeLane removes empty lane", () => {
  const b2 = addLane(b, { id: "c", name: "C" });
  expect(removeLane(b2, "c").lanes.map((l) => l.id)).toEqual(["a", "b"]);
});

test("reorderLanes reorders and rejects non-permutation", () => {
  expect(reorderLanes(b, ["b", "a"]).lanes.map((l) => l.id)).toEqual(["b", "a"]);
  expect(() => reorderLanes(b, ["a"])).toThrow(InvalidLaneOrder);
  expect(() => reorderLanes(b, ["a", "a"])).toThrow(InvalidLaneOrder);
  expect(() => reorderLanes(b, ["a", "b", "zz"])).toThrow(InvalidLaneOrder);
});

test("addCardToLane requires lane", () => {
  expect(() => addCardToLane(b, "zz", createCard({ id: "x", title: "x", now: T0 }))).toThrow(LaneNotFound);
});

test("findCard returns lane and card or null", () => {
  const found = findCard(b, "c3");
  expect(found.lane.id).toBe("b");
  expect(found.card.id).toBe("c3");
  expect(findCard(b, "zz")).toBeNull();
});

test("updateCard applies fn immutably", () => {
  const b2 = updateCard(b, "c1", (c) => ({ ...c, title: "Changed" }));
  expect(findCard(b2, "c1").card.title).toBe("Changed");
  expect(findCard(b, "c1").card.title).toBe("c1");
  expect(() => updateCard(b, "zz", (c) => c)).toThrow(CardNotFound);
});

test("removeCard removes", () => {
  expect(allIds(removeCard(b, "c1"))).toEqual(["c2", "c3"]);
  expect(() => removeCard(b, "zz")).toThrow(CardNotFound);
});

test("moveCard between lanes at position", () => {
  expect(ids(moveCard(b, "c1", "b", 0))).toEqual([["c2"], ["c1", "c3"]]);
});

test("moveCard clamps negative and oversized positions", () => {
  expect(ids(moveCard(b, "c1", "b", -5))).toEqual([["c2"], ["c1", "c3"]]);
  expect(ids(moveCard(b, "c1", "b", 99))).toEqual([["c2"], ["c3", "c1"]]);
});

test("moveCard to end of same lane", () => {
  expect(ids(moveCard(b, "c1", "a", 1))).toEqual([["c2", "c1"], ["c3"]]);
});

test("moveCard never duplicates or loses a card", () => {
  expect(allIds(moveCard(b, "c3", "a", 1)).sort()).toEqual(["c1", "c2", "c3"]);
});

test("moveCard unknown lane/card", () => {
  expect(() => moveCard(b, "zz", "a", 0)).toThrow(CardNotFound);
  expect(() => moveCard(b, "c1", "zz", 0)).toThrow(LaneNotFound);
});

test("createLabel appends and validates", () => {
  expect(withBug.labels).toEqual([{ id: "l1", name: "bug", color: "red" }]);
  expect(() => createLabel(withBug, { id: "l2", name: "BUG", color: "red" })).toThrow(DuplicateLabelName);
  expect(() => createLabel(b, { id: "l2", name: " ", color: "red" })).toThrow(EmptyTitle);
  expect(() => createLabel(b, { id: "l2", name: "x", color: "magenta" })).toThrow(InvalidLabelColor);
});

test("updateLabel allows keeping own name and validates", () => {
  const two = createLabel(withBug, { id: "l2", name: "ui", color: "teal" });
  expect(findLabel(updateLabel(two, "l1", { name: "Bug" }), "l1")).toEqual({ id: "l1", name: "Bug", color: "red" });
  expect(findLabel(updateLabel(two, "l1", { color: "blue" }), "l1").color).toBe("blue");
  expect(() => updateLabel(two, "l1", { name: "UI" })).toThrow(DuplicateLabelName);
  expect(() => updateLabel(two, "l1", { color: "nope" })).toThrow(InvalidLabelColor);
  expect(() => updateLabel(two, "zz", { name: "x" })).toThrow(LabelNotFound);
});

test("deleteLabel strips id from all cards", () => {
  const b2 = deleteLabel(withBugOnC1AndC3, "l1");
  expect(b2.labels).toEqual([]);
  expect(findCard(b2, "c1").card.labelIds).toEqual([]);
  expect(findCard(b2, "c3").card.labelIds).toEqual([]);
  expect(() => deleteLabel(b, "zz")).toThrow(LabelNotFound);
});

test("attachLabel requires label to exist", () => {
  expect(() => attachLabel(b, "c1", "nope", T0)).toThrow(LabelNotFound);
});

test("attachLabel/detachLabel update the card", () => {
  expect(findCard(withBugOnC1AndC3, "c1").card.labelIds).toEqual(["l1"]);
  expect(findCard(detachLabel(withBugOnC1AndC3, "c1", "l1", T0), "c1").card.labelIds).toEqual([]);
});

test("lanes built via createLane can be added", () => {
  const lane = createLane({ id: "z", name: "Z" });
  expect(addLane(b, lane).lanes.at(-1)).toEqual(lane);
});
