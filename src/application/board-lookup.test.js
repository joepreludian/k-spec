// @vitest-environment node
import { addLane } from "@/domain/board.js";
import { DomainError } from "@/domain/errors.js";
import { fixtureBoard } from "@/test/cli-fixture.js";
import {
  LookupError,
  cardByNumber,
  checklistItemAt,
  laneByName,
  normalizeStatus,
  parseCardNumber,
  serviceByTitle,
} from "./board-lookup.js";

const board = fixtureBoard();
const card4 = board.lanes[1].cards[0];
const card7 = board.lanes[0].cards[0];

test("card numbers are read strictly", () => {
  expect(parseCardNumber("4")).toBe(4);
  expect(parseCardNumber("#4")).toBe(4);
  for (const bad of ["4abc", "0", "-1", "", "#", "4.0", " 4", "four", "04"])
    expect(() => parseCardNumber(bad)).toThrow(`Not a card number: ${bad}`);
});

test("a card is found by number with its lane", () => {
  const { card, lane } = cardByNumber(board, 4);
  expect([card.title, lane.name]).toEqual(["Four", "In progress"]);
  expect(() => cardByNumber(board, 99)).toThrow("Card #99 not found");
});

test("a lane is found by whole name, ignoring case", () => {
  expect(laneByName(board, " in PROGRESS ").id).toBe("lane-in-progress");
  expect(() => laneByName(board, "In")).toThrow('Lane "In" not found (lanes: Backlog, In progress, Done)');
});

test("two lanes with the same name are reported, not guessed", () => {
  const twoDone = addLane(board, { id: "lane-done-2", name: "done" });
  expect(() => laneByName(twoDone, "done")).toThrow('Lane "done" matches several lanes (Done, done)');
  expect(() => laneByName(twoDone, "done")).toThrow(expect.objectContaining({ code: "AMBIGUOUS" }));
});

test("a checklist item is found by its c.i number", () => {
  expect(checklistItemAt(card4, "1.2").item.text).toBe("a2");
  expect(checklistItemAt(card4, "2.1").checklist.title).toBe("B");
  for (const bad of ["1", "a.b", "0.1", "1.0", "", "1.-1", " 1.1"])
    expect(() => checklistItemAt(card4, bad)).toThrow(
      `Not an item: ${bad} (use the c.i number from show, e.g. 1.2, or <checklist title>.<i>)`,
    );
  expect(() => checklistItemAt(card4, "9.9")).toThrow("Card #4 has no item 9.9");
  expect(() => checklistItemAt(card4, "1.3")).toThrow("Card #4 has no item 1.3");
});

test("a service is found by title on the active work", () => {
  expect(serviceByTitle(card4, "preview").title).toBe("Preview");
  expect(() => serviceByTitle(card4, "Api")).toThrow('Service "Api" not found on card #4 (services: Preview, Docs)');
  expect(() => serviceByTitle(card7, "Preview")).toThrow("Card #7 has no active work");
});

test("waiting is short for waiting-for-input", () => {
  expect(normalizeStatus("waiting")).toBe("waiting-for-input");
  expect(normalizeStatus("blocked")).toBe("blocked");
});

test("lookup failures are domain errors", () => {
  expect(() => cardByNumber(board, 99)).toThrow(DomainError);
  expect(() => cardByNumber(board, 99)).toThrow(LookupError);
});

const items = (...texts) => texts.map((text) => ({ id: `item-${text}`, text, done: false }));
// A card whose checklists are easy to confuse: a title with dots, and one that is a number.
const planned = {
  number: 4,
  checklists: [
    { id: "k1", title: "Plan", items: items("p1", "p2", "p3") },
    { id: "k2", title: "v1.2 Plan", items: items("v1", "v2", "v3") },
    { id: "k3", title: "2", items: items("only") },
  ],
};
const twice = {
  number: 5,
  checklists: [
    { id: "k1", title: "Plan", items: items("x") },
    { id: "k2", title: "plan", items: items("y") },
  ],
};

test("an item is found by its checklist's title and its number in it", () => {
  for (const ref of ["Plan.2", "plan.2", " Plan .2"]) {
    const found = checklistItemAt(planned, ref);
    expect([found.checklist.id, found.item.text]).toEqual(["k1", "p2"]);
  }
});

test("the title is everything before the last dot", () => {
  expect(checklistItemAt(planned, "v1.2 Plan.3").item.text).toBe("v3");
});

test("digits before the dot always mean the checklist's number", () => {
  // Checklist number 2 is "v1.2 Plan"; the checklist titled "2" is number 3.
  expect(checklistItemAt(planned, "2.1").item.text).toBe("v1");
  expect(checklistItemAt(planned, "3.1").item.text).toBe("only");
});

test("a title no checklist has, or two have, is refused", () => {
  expect(() => checklistItemAt(planned, "Nope.1")).toThrow(
    expect.objectContaining({ code: "NOT_FOUND", message: 'Checklist "Nope" not found on card #4 (checklists: Plan, v1.2 Plan, 2)' }),
  );
  expect(() => checklistItemAt(twice, "Plan.1")).toThrow(
    expect.objectContaining({ code: "AMBIGUOUS", message: 'Checklist "Plan" matches several checklists on card #5 (use the c.i number from show)' }),
  );
  // Still reachable by number.
  expect(checklistItemAt(twice, "2.1").item.text).toBe("y");
});

test("an item that is not there, and text that is neither form", () => {
  expect(() => checklistItemAt(planned, "Plan.9")).toThrow("Card #4 has no item Plan.9");
  for (const bad of ["Plan", "Plan.", "Plan.0", ".1", " .1", "Plan.x", "Plan.1x"]) {
    expect(() => checklistItemAt(planned, bad)).toThrow(expect.objectContaining({ code: "INVALID_REFERENCE" }));
  }
});
