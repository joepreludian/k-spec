// @vitest-environment node
import { boardOf } from "@/test/board-server.js";
import { fixtureBoard } from "@/test/cli-fixture.js";
import { formatTime, renderBoard, renderCard } from "./render.js";

const board = fixtureBoard();
const [lane7, lane4] = board.lanes;
const card7 = lane7.cards[0];
const card4 = lane4.cards[0];

test("times print as UTC minutes", () => {
  expect(formatTime("2026-11-14T09:05:59.123Z")).toBe("2026-11-14 09:05");
});

test("the board is one line per card with only what exists", () => {
  expect(renderBoard({ board, version: 12 })).toBe(
    [
      "Test board  v12",
      "Backlog (1)",
      "  #7 blocked  Seven",
      "In progress (1)",
      "  #4 idle     Four  [cli]  1/3 done  2 comments  work feat/cli",
      "Done (0)",
    ].join("\n"),
  );
});

test("one comment is singular", () => {
  const one = structuredClone(board);
  one.lanes[1].cards[0].comments.pop();
  expect(renderBoard({ board: one, version: 1 })).toContain("  1 comment  work");
});

test("filters narrow the board and drop empty lanes", () => {
  expect(renderBoard({ board, version: 12 }, { status: "blocked" })).toBe(
    "Test board  v12\nBacklog (1)\n  #7 blocked  Seven",
  );
  expect(renderBoard({ board, version: 12 }, { lane: "in progress" })).toContain("In progress (1)");
  expect(renderBoard({ board, version: 12 }, { lane: "in progress" })).not.toContain("Backlog");
  expect(renderBoard({ board, version: 12 }, { lane: "done" })).toBe("Test board  v12");
  expect(renderBoard({ board, version: 12 }, { status: "waiting" })).toBe("Test board  v12");
  expect(() => renderBoard({ board, version: 12 }, { lane: "Nope" })).toThrow('Lane "Nope" not found');
});

test("a board with no lanes is just its header", () => {
  expect(renderBoard({ board: boardOf({}), version: 1 })).toBe("Test board  v1");
});

test("a card prints in full", () => {
  expect(renderCard(board, card4, lane4)).toBe(
    [
      "#4 Four",
      "lane In progress | status idle | labels cli | updated 2026-11-10 10:00",
      "",
      "Description",
      "Parse **flags**.",
      "Then help.",
      "",
      "Checklist 1: A (1/2)",
      "  1.1 [x] a1",
      "  1.2 [ ] a2",
      "Checklist 2: B (0/1)",
      "  2.1 [ ] b1",
      "Links",
      "  Design  docs/a.md",
      "Work  host:box  branch feat/cli  since 2026-11-10 10:00",
      "Services",
      "  Preview  http://localhost:5173",
      "  Docs  http://localhost:5174",
      "Comments (2)",
      "  You, 2026-11-10 10:00: Start here.",
      "  Claude (agent), 2026-11-10 10:00: Done.",
      "    Help next.",
    ].join("\n"),
  );
});

test("a worktree path is shown with the work", () => {
  const moved = structuredClone(card4);
  moved.work.worktreePath = "/w/cli";
  expect(renderCard(board, moved, lane4)).toContain(
    "\nWork  host:box  branch feat/cli  since 2026-11-10 10:00  worktree /w/cli\n",
  );
});

test("a bare card prints its two header lines only", () => {
  expect(renderCard(board, card7, lane7)).toBe(
    "#7 Seven\nlane Backlog | status blocked | updated 2026-11-10 10:00",
  );
});

test("activity is added on request", () => {
  expect(renderCard(board, card7, lane7, { activity: true })).toBe(
    "#7 Seven\nlane Backlog | status blocked | updated 2026-11-10 10:00\n\nActivity\n  2026-11-10 10:00 status-changed",
  );
});
