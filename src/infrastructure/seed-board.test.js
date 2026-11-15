import { seedBoard } from "./seed-board.js";
import { AGENT_STATUSES } from "@/domain/agent-status.js";
import { findCard, reorderLanes } from "@/domain/board.js";

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

test("seeds work, history, session and links as the design describes", () => {
  const board = seedBoard();
  const card = (id) => findCard(board, id).card;
  expect(card("card-3").work).toMatchObject({
    location: { kind: "lima", name: "lima-dev-k-spec-watcher" },
    branch: "feat/watcher",
    worktreePath: "~/work/k-spec",
  });
  expect(card("card-3").work.session).toMatchObject({
    id: "8c4acf00-42c1-4317-b31b-d24e744d30d3",
    model: "claude-fable-5-1",
    tokens: { input: 184000, output: 22000, cached: 61000 },
    turns: 37,
    lastTool: { name: "Bash" },
  });
  expect(card("card-3").workHistory).toHaveLength(1);
  expect(card("card-3").workHistory[0]).toMatchObject({
    location: { kind: "host", name: "jon-mbp" },
    branch: "main",
    session: { tokens: { input: 36000, output: 5000, cached: 12000 }, turns: 9 },
  });
  expect(card("card-3").workHistory[0].endedAt).toBe(card("card-3").work.startedAt);
  expect(card("card-4").work).toMatchObject({ location: { kind: "worktree", name: "k-spec-cli" }, branch: "feat/cli", session: null });
  expect(card("card-2").work).toMatchObject({ location: { kind: "host", name: "jon-mbp" }, branch: "main" });
  expect(card("card-3").links.map((l) => l.path)).toEqual([
    "docs/specs/2026-11-14-k-spec-board-ui-design.md",
    "docs/specs/2026-11-14-k-spec-board-ui-plan.md",
  ]);
  expect(card("card-2").links).toHaveLength(1);
  expect(card("card-3").events.some((e) => e.type === "status-changed" && e.to === "working")).toBe(true);
  expect(card("card-3").events.map((e) => e.type)).toEqual(["status-changed", "work-started", "work-ended", "work-started"]);
});

test("seeds the project block", () => {
  expect(seedBoard().project).toEqual({
    name: "opensource/k-spec",
    links: [{ id: "link-repo", title: "Repo", url: "https://github.com/opensource/k-spec" }],
    readmePath: "README.md",
  });
});

test("card-3's previous work happened on 2026-11-14", () => {
  const entry = findCard(seedBoard(), "card-3").card.workHistory[0];
  expect(entry.startedAt.slice(0, 10)).toBe("2026-11-14");
  expect(entry.endedAt.slice(0, 10)).toBe("2026-11-14");
});

test("card-3 publishes two services on its active work; other work has none", () => {
  const board = seedBoard();
  expect(findCard(board, "card-3").card.work.services).toEqual([
    { id: "service-1", title: "lima-dev-k-spec-main.local:3000", url: "http://lima-dev-k-spec-main.local:3000" },
    { id: "service-2", title: "localhost:8002", url: "http://localhost:8002" },
  ]);
  expect(findCard(board, "card-2").card.work.services).toEqual([]);
  expect(findCard(board, "card-4").card.work.services).toEqual([]);
  expect(findCard(board, "card-3").card.workHistory[0].services).toEqual([]);
});
