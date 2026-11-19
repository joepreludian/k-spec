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
  for (const bad of ["1", "a.b", "1.2.3", "0.1", "1.0", "", "1.-1", " 1.1"])
    expect(() => checklistItemAt(card4, bad)).toThrow(
      `Not an item number: ${bad} (use the c.i number from show, e.g. 1.2)`,
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
