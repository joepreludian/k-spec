import { DEFAULT_AGENT_STATUS, assertAgentStatus } from "./agent-status.js";
import { createAuthor } from "./author.js";
import {
  ChecklistItemNotFound,
  ChecklistNotFound,
  DuplicateLink,
  EmptyText,
  EmptyTitle,
  InvalidCardNumber,
  LinkNotFound,
  NoActiveWork,
} from "./errors.js";
import { assertMarkdownPath } from "./markdown-path.js";
import { requireNonEmpty } from "./text.js";
import { assertWorkSession, createWork, withActivityStamp } from "./work.js";

function assertCardNumber(number) {
  if (!Number.isInteger(number) || number < 1) throw new InvalidCardNumber();
  return number;
}

export function createCard({ id, number, title, now }) {
  return {
    id,
    number: assertCardNumber(number),
    title: requireNonEmpty(title, EmptyTitle),
    description: "",
    labelIds: [],
    agentStatus: DEFAULT_AGENT_STATUS,
    checklists: [],
    comments: [],
    links: [],
    work: null,
    workHistory: [],
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

const touch = (card, changes, now) => ({ ...card, ...changes, updatedAt: now });

export function renameCard(card, title, now) {
  return touch(card, { title: requireNonEmpty(title, EmptyTitle) }, now);
}

export function updateDescription(card, markdown, now) {
  return touch(card, { description: typeof markdown === "string" ? markdown : "" }, now);
}

export function addLabelToCard(card, labelId, now) {
  if (card.labelIds.includes(labelId)) return touch(card, {}, now);
  return touch(card, { labelIds: [...card.labelIds, labelId] }, now);
}

export function removeLabelFromCard(card, labelId, now) {
  return touch(card, { labelIds: card.labelIds.filter((id) => id !== labelId) }, now);
}

const withEvent = (card, event) => ({ ...card, events: [...card.events, event] });

export function setAgentStatus(card, status, now) {
  const next = assertAgentStatus(status);
  const changed = next !== card.agentStatus;
  const updated = touch(card, { agentStatus: next }, now);
  return changed
    ? withEvent(updated, { type: "status-changed", from: card.agentStatus, to: next, at: now })
    : updated;
}

// --- work ----------------------------------------------------------------

const workEvent = (type, work, at) => ({ type, location: work.location, branch: work.branch, at });

/** Moves the active work block into history (no updatedAt change; callers touch). */
function archiveWork(card, now) {
  if (!card.work) return card;
  return withEvent(
    { ...card, work: null, workHistory: [...card.workHistory, { ...card.work, endedAt: now }] },
    workEvent("work-ended", card.work, now),
  );
}

export function startWork(card, { location, branch, worktreePath, session }, now) {
  const work = createWork({ location, branch, worktreePath, session, now });
  const archived = archiveWork(card, now);
  return withEvent(touch(archived, { work }, now), workEvent("work-started", work, now));
}

/** Replaces the session block. Deliberately does not bump updatedAt or add an event (token ticks). */
export function updateWorkSession(card, session, now) {
  if (!card.work) throw new NoActiveWork();
  return { ...card, work: { ...card.work, session: withActivityStamp(assertWorkSession(session), now) } };
}

export function endWork(card, now) {
  if (!card.work) throw new NoActiveWork();
  return touch(archiveWork(card, now), {}, now);
}

export function addChecklist(card, { id, title }, now) {
  const checklist = { id, title: requireNonEmpty(title, EmptyTitle), items: [] };
  return touch(card, { checklists: [...card.checklists, checklist] }, now);
}

function findChecklist(card, checklistId) {
  const checklist = card.checklists.find((k) => k.id === checklistId);
  if (!checklist) throw new ChecklistNotFound(checklistId);
  return checklist;
}

function replaceChecklist(card, checklistId, fn, now) {
  const current = findChecklist(card, checklistId);
  const next = fn(current);
  return touch(
    card,
    { checklists: card.checklists.map((k) => (k.id === checklistId ? next : k)) },
    now,
  );
}

function findItem(checklist, itemId) {
  const item = checklist.items.find((i) => i.id === itemId);
  if (!item) throw new ChecklistItemNotFound(itemId);
  return item;
}

export function removeChecklist(card, checklistId, now) {
  findChecklist(card, checklistId);
  return touch(
    card,
    { checklists: card.checklists.filter((k) => k.id !== checklistId) },
    now,
  );
}

export function addChecklistItem(card, checklistId, { id, text }, now) {
  const item = { id, text: requireNonEmpty(text, EmptyText), done: false };
  return replaceChecklist(
    card,
    checklistId,
    (k) => ({ ...k, items: [...k.items, item] }),
    now,
  );
}

export function toggleChecklistItem(card, checklistId, itemId, now) {
  return replaceChecklist(
    card,
    checklistId,
    (k) => {
      findItem(k, itemId);
      return {
        ...k,
        items: k.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
      };
    },
    now,
  );
}

export function removeChecklistItem(card, checklistId, itemId, now) {
  return replaceChecklist(
    card,
    checklistId,
    (k) => {
      findItem(k, itemId);
      return { ...k, items: k.items.filter((i) => i.id !== itemId) };
    },
    now,
  );
}

export function addComment(card, { id, author, body }, now) {
  const comment = {
    id,
    author: createAuthor(author),
    body: requireNonEmpty(body, EmptyText),
    createdAt: now,
  };
  return touch(card, { comments: [...card.comments, comment] }, now);
}

export function addLink(card, { id, title, path }, now) {
  const cleanPath = assertMarkdownPath(path);
  if (card.links.some((l) => l.path === cleanPath)) throw new DuplicateLink(cleanPath);
  const link = { id, title: requireNonEmpty(title, EmptyTitle), path: cleanPath };
  return touch(card, { links: [...card.links, link] }, now);
}

export function removeLink(card, linkId, now) {
  if (!card.links.some((l) => l.id === linkId)) throw new LinkNotFound(linkId);
  return touch(card, { links: card.links.filter((l) => l.id !== linkId) }, now);
}

export function checklistProgress(checklist) {
  return {
    done: checklist.items.filter((i) => i.done).length,
    total: checklist.items.length,
  };
}

/** One `{ id, title, done, total }` per checklist, in order. */
export function checklistSummaries(card) {
  return card.checklists.map((k) => ({ id: k.id, title: k.title, ...checklistProgress(k) }));
}

export function cardProgress(card) {
  return card.checklists.reduce(
    (acc, k) => {
      const p = checklistProgress(k);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
}
