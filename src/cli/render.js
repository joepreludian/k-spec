import { laneByName, normalizeStatus } from "@/application/board-lookup.js";
import { assertAgentStatus } from "@/domain/agent-status.js";
import { cardProgress, checklistProgress } from "@/domain/card.js";

// What a card says is printed next to what the CLI says, and the reader may be an agent. Text
// from the board must not be able to start a line of its own or drive the terminal: fields that
// belong on one line lose their line breaks and control characters, and longer text (a
// description, a comment) is indented under its heading with control characters removed.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_BUT_LAYOUT = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** `text` as it may appear inside one printed line. */
export const oneLine = (text) => String(text).replace(CONTROL, " ");

/** The lines of a longer text, safe to print under a heading. */
const textLines = (text) => String(text).replace(/\r\n?/g, "\n").replace(CONTROL_BUT_LAYOUT, "").split("\n");

/** An ISO timestamp as `YYYY-MM-DD HH:MM`, UTC. */
export function formatTime(iso) {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const labelNames = (board, card) =>
  card.labelIds
    .map((id) => board.labels.find((label) => label.id === id)?.name)
    .filter(Boolean)
    .map(oneLine);

function cardLine(board, card, statusWidth) {
  const progress = cardProgress(card);
  const labels = labelNames(board, card);
  const segments = [
    `#${card.number} ${card.agentStatus.padEnd(statusWidth)}`,
    oneLine(card.title),
    labels.length > 0 && `[${labels.join(", ")}]`,
    progress.total > 0 && `${progress.done}/${progress.total} done`,
    card.comments.length > 0 && count(card.comments.length, "comment"),
    card.work && `work ${oneLine(card.work.branch)}`,
  ];
  return `  ${segments.filter(Boolean).join("  ")}`;
}

/**
 * The board as text: a header, then each lane with one line per card. `lane` (a name) and
 * `status` narrow it; with either given, lanes left without a card are not printed.
 */
export function renderBoard({ board, version }, { lane, status } = {}) {
  const onlyLane = lane === undefined ? null : laneByName(board, lane);
  const onlyStatus = status === undefined ? null : assertAgentStatus(normalizeStatus(status));
  const filtered = onlyLane !== null || onlyStatus !== null;
  const lanes = board.lanes
    .filter((l) => onlyLane === null || l.id === onlyLane.id)
    .map((l) => ({ name: l.name, cards: l.cards.filter((c) => onlyStatus === null || c.agentStatus === onlyStatus) }))
    .filter((l) => !filtered || l.cards.length > 0);
  const statusWidth = Math.max(0, ...lanes.flatMap((l) => l.cards.map((c) => c.agentStatus.length)));
  const lines = [`${oneLine(board.name)}  v${version}`];
  for (const l of lanes) {
    lines.push(`${oneLine(l.name)} (${l.cards.length})`);
    for (const card of l.cards) lines.push(cardLine(board, card, statusWidth));
  }
  return lines.join("\n");
}

function commentLines(comment) {
  const name = oneLine(comment.author.name);
  const who = comment.author.kind === "agent" ? `${name} (agent)` : name;
  const [first, ...rest] = textLines(comment.body);
  return [`  ${who}, ${formatTime(comment.createdAt)}: ${first}`, ...rest.map((line) => `    ${line}`)];
}

/** One card in full. Sections with nothing in them are left out; `activity` adds the event log. */
export function renderCard(board, card, lane, { activity = false } = {}) {
  const labels = labelNames(board, card);
  const header = [
    `lane ${oneLine(lane.name)}`,
    `status ${card.agentStatus}`,
    labels.length > 0 && `labels ${labels.join(", ")}`,
    `updated ${formatTime(card.updatedAt)}`,
  ];
  const body = [];
  if (card.description) {
    body.push("Description", ...textLines(card.description).map((line) => (line ? `  ${line}` : "")), "");
  }
  card.checklists.forEach((checklist, c) => {
    const { done, total } = checklistProgress(checklist);
    body.push(`Checklist ${c + 1}: ${oneLine(checklist.title)} (${done}/${total})`);
    checklist.items.forEach((item, i) => body.push(`  ${c + 1}.${i + 1} [${item.done ? "x" : " "}] ${oneLine(item.text)}`));
  });
  if (card.links.length > 0) body.push("Links", ...card.links.map((link) => `  ${oneLine(link.title)}  ${oneLine(link.path)}`));
  if (card.work) {
    const { location, branch, startedAt, worktreePath, services } = card.work;
    body.push(
      [
        "Work",
        `${oneLine(location.kind)}:${oneLine(location.name)}`,
        `branch ${oneLine(branch)}`,
        `since ${formatTime(startedAt)}`,
        worktreePath && `worktree ${oneLine(worktreePath)}`,
      ]
        .filter(Boolean)
        .join("  "),
    );
    if (services.length > 0) body.push("Services", ...services.map((s) => `  ${oneLine(s.title)}  ${oneLine(s.url)}`));
  }
  if (card.comments.length > 0) body.push(`Comments (${card.comments.length})`, ...card.comments.flatMap(commentLines));
  if (activity && card.events.length > 0) {
    body.push("Activity", ...card.events.map((event) => `  ${formatTime(event.at)} ${oneLine(event.type)}`));
  }
  while (body.at(-1) === "") body.pop();
  const lines = [`#${card.number} ${oneLine(card.title)}`, header.filter(Boolean).join(" | ")];
  if (body.length > 0) lines.push("", ...body);
  return lines.join("\n");
}
