import {
  addCardToLane,
  addLane,
  attachLabel,
  createBoard,
  createLabel,
  setProject,
  updateCard,
} from "@/domain/board.js";
import {
  addChecklist,
  addChecklistItem,
  addComment,
  addLink,
  createCard,
  setAgentStatus,
  startWork,
  toggleChecklistItem,
  updateDescription,
  updateWorkSession,
  publishService,
} from "@/domain/card.js";
import { PERSON } from "@/domain/author.js";

const BASE = Date.parse("2026-11-14T09:00:00.000Z");
const at = (hoursAgo) => new Date(BASE - hoursAgo * 3600_000).toISOString();
const CLAUDE = { kind: "agent", name: "claude" };
const MODEL = "claude-fable-5-1";
const HOST = { kind: "host", name: "jon-mbp" };
const MIN = 1 / 60;

const LANES = [
  ["lane-backlog", "Backlog"],
  ["lane-todo", "Todo"],
  ["lane-in-progress", "In Progress"],
  ["lane-review", "Review"],
  ["lane-done", "Done"],
];

const LABELS = [
  ["label-spec", "spec", "blue"],
  ["label-bug", "bug", "red"],
  ["label-cli", "cli", "violet"],
  ["label-ui", "ui", "teal"],
  ["label-infra", "infra", "amber"],
];

/**
 * Each card: lane, title, created hours ago, then a list of steps applied in order.
 * Steps: ["desc", md] | ["status", s] | ["label", id] | ["checklist", id, title, [[itemId, text, done]...]]
 *        | ["comment", id, author, body, hoursAgo]
 *        | ["work", startWorkInput, hoursAgo] | ["session", session, hoursAgo] | ["link", id, title, path]
 */
const CARDS = [
  {
    id: "card-1", lane: "lane-done", title: "Project scaffold and CLAUDE.md", age: 72,
    steps: [
      ["desc", "Next.js 16, Tailwind 4, shadcn in JSX mode, Vitest. DDD layers under `src/`."],
      ["label", "label-infra"],
      ["comment", "comment-1", CLAUDE, "Scaffold is in. Lint, tests and build are green.", 70],
    ],
  },
  {
    id: "card-2", lane: "lane-review", title: "Board domain model", age: 60,
    steps: [
      ["desc", "Board aggregate with lanes, cards, board-level label catalogue.\n\n- immutable updates\n- ISO timestamps"],
      ["label", "label-spec"],
      ["status", "waiting-for-input"],
      ["checklist", "checklist-1", "Acceptance", [["item-1", "moveCard clamps positions", true], ["item-2", "deleteLabel detaches from cards", true], ["item-3", "round-trips to frontmatter", false]]],
      ["comment", "comment-2", PERSON, "Should removing a non-empty lane move its cards somewhere, or fail?", 30],
      ["comment", "comment-3", CLAUDE, "I made it fail with LaneNotEmpty so nothing moves silently. Want the auto-move instead?", 29],
      ["work", { location: HOST, branch: "main" }, 31],
      ["link", "link-3", "Board UI design", "docs/specs/2026-11-14-k-spec-board-ui-design.md"],
    ],
  },
  {
    id: "card-3", lane: "lane-in-progress", title: "File watcher for docs/k-spec", age: 48,
    steps: [
      ["desc", "Watch the `docs/k-spec` folder and push changes to the UI.\n\nLane = folder, card = markdown + frontmatter."],
      ["label", "label-infra"],
      ["label", "label-spec"],
      ["status", "working"],
      ["checklist", "checklist-2", "Steps", [["item-4", "chokidar watcher", true], ["item-5", "debounce bursts", false], ["item-6", "SSE channel to the browser", false]]],
      ["comment", "comment-4", CLAUDE, "Watcher prototype running; working on debounce now.", 2],
      ["work", { location: HOST, branch: "main" }, 8],
      ["session", { id: "a9cb8a9d-1c2e-4f3a-9b7d-5e6f7a8b9c0d", model: MODEL, tokens: { input: 36000, output: 5000, cached: 12000 }, turns: 9, lastTool: null }, 7],
      ["work", { location: { kind: "lima", name: "lima-dev-k-spec-watcher" }, branch: "feat/watcher", worktreePath: "~/work/k-spec" }, 41 * MIN],
      ["session", { id: "8c4acf00-42c1-4317-b31b-d24e744d30d3", model: MODEL, tokens: { input: 184000, output: 22000, cached: 61000 }, turns: 37, lastTool: { name: "Bash", at: at(2 * MIN) } }, 2 * MIN],
      ["service", "service-1", "http://lima-dev-k-spec-main.local:3000", 2 * MIN],
      ["service", "service-2", "http://localhost:8002", 2 * MIN],
      ["link", "link-1", "Board UI design", "docs/specs/2026-11-14-k-spec-board-ui-design.md"],
      ["link", "link-2", "Board UI plan", "docs/specs/2026-11-14-k-spec-board-ui-plan.md"],
    ],
  },
  {
    id: "card-4", lane: "lane-in-progress", title: "CLI argument parser", age: 40,
    steps: [
      ["desc", "`k-spec-cli <command> [--flags]` mapping 1:1 onto the command registry."],
      ["label", "label-cli"],
      ["status", "blocked"],
      ["comment", "comment-5", CLAUDE, "Blocked: the API isn't up yet, so there's nothing for the CLI to call. Should I stub it?", 5],
      ["work", { location: { kind: "worktree", name: "k-spec-cli" }, branch: "feat/cli", worktreePath: "~/work/k-spec/.worktrees/cli" }, 6],
    ],
  },
  {
    id: "card-5", lane: "lane-todo", title: "Token link access gate", age: 30,
    steps: [
      ["desc", "Single shared token, `?token=` sets a cookie, `/access` page otherwise."],
      ["label", "label-infra"],
      ["label", "label-ui"],
      ["checklist", "checklist-3", "Checks", [["item-7", "constant-time compare", false], ["item-8", "link printed on start", false]]],
    ],
  },
  {
    id: "card-6", lane: "lane-todo", title: "Card detail: markdown description editor", age: 26,
    steps: [
      ["label", "label-ui"],
      ["comment", "comment-6", PERSON, "Keep the editor plain: textarea + preview toggle is enough.", 20],
    ],
  },
  {
    id: "card-7", lane: "lane-backlog", title: "Lane folder ↔ markdown mapping", age: 20,
    steps: [
      ["desc", "Decide the on-disk shape: `docs/k-spec/<lane>/<card-id>.md` with frontmatter for labels, status, checklists."],
      ["label", "label-spec"],
    ],
  },
  {
    id: "card-8", lane: "lane-backlog", title: "Drag preview flickers on Firefox", age: 10,
    steps: [
      ["label", "label-bug"],
      ["label", "label-ui"],
    ],
  },
];

function buildCard(spec, board) {
  const number = Number(spec.id.slice("card-".length));
  let card = createCard({ id: spec.id, number, title: spec.title, now: at(spec.age) });
  const touched = at(spec.age - 1);
  for (const step of spec.steps) {
    switch (step[0]) {
      case "desc":
        card = updateDescription(card, step[1], touched);
        break;
      case "status":
        card = setAgentStatus(card, step[1], touched);
        break;
      case "label":
        // labels are attached at board level after the card exists (see seedBoard)
        break;
      case "checklist": {
        const [, id, title, items] = step;
        card = addChecklist(card, { id, title }, touched);
        for (const [itemId, text, done] of items) {
          card = addChecklistItem(card, id, { id: itemId, text }, touched);
          if (done) card = toggleChecklistItem(card, id, itemId, touched);
        }
        break;
      }
      case "comment": {
        const [, id, author, body, hoursAgo] = step;
        card = addComment(card, { id, author, body }, at(hoursAgo));
        break;
      }
      case "work":
        card = startWork(card, step[1], at(step[2]));
        break;
      case "session":
        card = updateWorkSession(card, step[1], at(step[2]));
        break;
      case "service":
        card = publishService(card, { id: step[1], url: step[2] }, at(step[3]));
        break;
      case "link":
        card = addLink(card, { id: step[1], title: step[2], path: step[3] }, touched);
        break;
      default:
        throw new Error(`Unknown seed step ${step[0]}`);
    }
  }
  return { card, labelIds: spec.steps.filter((s) => s[0] === "label").map((s) => s[1]), board };
}

export function seedBoard() {
  let board = setProject(createBoard({ id: "board-1", name: "k-spec" }), {
    name: "opensource/k-spec",
    links: [{ id: "link-repo", title: "Repo", url: "https://github.com/opensource/k-spec" }],
    readmePath: "README.md",
  });
  for (const [id, name] of LANES) board = addLane(board, { id, name });
  for (const [id, name, color] of LABELS) board = createLabel(board, { id, name, color });
  for (const spec of CARDS) {
    const { card, labelIds } = buildCard(spec);
    board = addCardToLane(board, spec.lane, card);
    for (const labelId of labelIds) board = attachLabel(board, spec.id, labelId, card.updatedAt);
    board = updateCard(board, spec.id, (c) => ({ ...c, updatedAt: card.updatedAt }));
  }
  return board;
}
