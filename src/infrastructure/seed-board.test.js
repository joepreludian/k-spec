import { seedBoard } from "./seed-board.js";
import { AGENT_STATUSES } from "@/domain/agent-status.js";
import { reorderLanes } from "@/domain/board.js";

const allCards = (b) => b.lanes.flatMap((l) => l.cards);

test("has default lanes in order", () => {
  expect(seedBoard().lanes.map((l) => l.name)).toEqual(["Backlog", "Todo", "In Progress", "Review", "Done"]);
  expect(seedBoard().name).toBe("k-spec");
});

test("exercises every feature", () => {
  const board = seedBoard();
  const cards = allCards(board);
  expect(cards).toHaveLength(8);
  expect(new Set(cards.map((c) => c.agentStatus))).toEqual(new Set(AGENT_STATUSES));
  expect(
    cards.some((c) => c.checklists.some((k) => k.items.some((i) => i.done) && k.items.some((i) => !i.done))),
  ).toBe(true);
  expect(
    cards.some(
      (c) => c.comments.some((m) => m.author.kind === "agent") && c.comments.some((m) => m.author.kind === "person"),
    ),
  ).toBe(true);
  expect(board.labels.length).toBeGreaterThanOrEqual(5);
  expect(cards.every((c) => c.labelIds.every((id) => board.labels.some((l) => l.id === id)))).toBe(true);
  expect(cards.some((c) => c.labelIds.length > 0)).toBe(true);
  expect(cards.some((c) => c.description.length > 0)).toBe(true);
});

test("returns a fresh object each call", () => {
  expect(seedBoard()).not.toBe(seedBoard());
  expect(seedBoard()).toEqual(seedBoard());
});

test("seed is valid (lane ids form a permutation)", () => {
  const b = seedBoard();
  expect(() => reorderLanes(b, b.lanes.map((l) => l.id))).not.toThrow();
  const ids = allCards(b).map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("cards are numbered 1..8 in creation order and the counter is 9", () => {
  const board = seedBoard();
  expect(
    allCards(board)
      .map((c) => [c.id, c.number])
      .sort((a, b) => a[1] - b[1]),
  ).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`card-${n}`, n]));
  expect(board.nextCardNumber).toBe(9);
});
