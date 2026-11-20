import { cardByNumber } from "@/application/board-lookup.js";
import { COMMANDS } from "@/application/commands.js";
import { PERSON } from "@/domain/author.js";
import { updateCard } from "@/domain/board.js";
import { addComment } from "@/domain/card.js";
import { fixedClock } from "@/infrastructure/clock.js";
import { sequentialIdGenerator } from "@/infrastructure/id-generator.js";
import { createInMemoryBoardRepository } from "@/infrastructure/in-memory-board-repository.js";
import { boardOf } from "./board-server.js";

const NOW = "2026-11-10T10:00:00.000Z";

async function build() {
  // boardOf leaves the counter after the last card it made (#4); a real board counts on from its highest.
  const repository = createInMemoryBoardRepository({
    ...boardOf({ Backlog: ["7:Seven"], "In progress": ["4:Four"], Done: [] }),
    nextCardNumber: 8,
  });
  const deps = { repository, clock: fixedClock(NOW), idGenerator: sequentialIdGenerator("fx") };
  const run = (name, input) => COMMANDS[name](deps, input);
  const cardId = "card-4";
  const a = (await run("addChecklist", { cardId, title: "A" })).id;
  const a1 = (await run("addChecklistItem", { cardId, checklistId: a, text: "a1" })).id;
  await run("addChecklistItem", { cardId, checklistId: a, text: "a2" });
  const b = (await run("addChecklist", { cardId, title: "B" })).id;
  await run("addChecklistItem", { cardId, checklistId: b, text: "b1" });
  await run("toggleChecklistItem", { cardId, checklistId: a, itemId: a1 });
  const label = (await run("createLabel", { name: "cli", color: "blue" })).id;
  await run("addLabel", { cardId, labelId: label });
  await run("updateCardDescription", { cardId, description: "Parse **flags**.\nThen help." });
  await run("addCardLink", { cardId, title: "Design", path: "docs/a.md" });
  await run("addComment", { cardId, body: "Start here." });
  await run("addComment", { cardId, body: "Done.\nHelp next.", author: { kind: "agent", name: "Claude" } });
  await run("startWork", {
    cardId,
    location: { kind: "host", name: "box" },
    branch: "feat/cli",
    worktreePath: null,
    session: null,
  });
  await run("publishService", { cardId, title: "Preview", url: "http://localhost:5173" });
  await run("publishService", { cardId, title: "Docs", url: "http://localhost:5174" });
  await run("setAgentStatus", { cardId: "card-7", status: "blocked" });
  return repository.load();
}

const FIXTURE = await build();

/**
 * The board the CLI tests share: Backlog [#7 Seven, blocked], In progress [#4 Four, with two
 * checklists (A: a1 ticked, a2; B: b1), label cli, a description, a link, two comments, active
 * work on feat/cli with services Preview and Docs], Done []. Every timestamp is 2026-11-10 10:00 UTC.
 */
export const fixtureBoard = () => structuredClone(FIXTURE);

/**
 * `board` with one more comment on card `#number`: `{ id, body, request, author, at }`.
 * `request: true` makes it a request to the agent; `author` defaults to the person.
 */
export function commentOn(board, number, { id, body, request = false, author = PERSON, at = NOW }) {
  const { card } = cardByNumber(board, number);
  return updateCard(board, card.id, (c) => addComment(c, { id, author, body, request }, at));
}
