import {
  addLabelToCard as cardAddLabel,
  removeLabelFromCard as cardRemoveLabel,
} from "./card.js";
import {
  CardNotFound,
  DuplicateLabelName,
  EmptyTitle,
  InvalidLaneOrder,
  LabelNotFound,
  LaneNotEmpty,
  LaneNotFound,
} from "./errors.js";
import { assertLabelColor } from "./label-colors.js";
import { createLane, renameLane as laneRename } from "./lane.js";
import { requireNonEmpty } from "./text.js";

export function createBoard({ id, name }) {
  return { id, name, lanes: [], labels: [] };
}

// --- lanes ---------------------------------------------------------------

export function findLane(board, laneId) {
  const lane = board.lanes.find((l) => l.id === laneId);
  if (!lane) throw new LaneNotFound(laneId);
  return lane;
}

function replaceLane(board, laneId, fn) {
  const current = findLane(board, laneId);
  const next = fn(current);
  return { ...board, lanes: board.lanes.map((l) => (l.id === laneId ? next : l)) };
}

export function addLane(board, laneOrInput) {
  const lane = Array.isArray(laneOrInput.cards) ? laneOrInput : createLane(laneOrInput);
  return { ...board, lanes: [...board.lanes, lane] };
}

export function renameLane(board, laneId, name) {
  return replaceLane(board, laneId, (lane) => laneRename(lane, name));
}

export function removeLane(board, laneId) {
  const lane = findLane(board, laneId);
  if (lane.cards.length > 0) throw new LaneNotEmpty(laneId);
  return { ...board, lanes: board.lanes.filter((l) => l.id !== laneId) };
}

export function reorderLanes(board, laneIds) {
  const current = board.lanes.map((l) => l.id);
  const isPermutation =
    Array.isArray(laneIds) &&
    laneIds.length === current.length &&
    new Set(laneIds).size === current.length &&
    laneIds.every((id) => current.includes(id));
  if (!isPermutation) throw new InvalidLaneOrder();
  return { ...board, lanes: laneIds.map((id) => findLane(board, id)) };
}

// --- cards ---------------------------------------------------------------

export function addCardToLane(board, laneId, card) {
  return replaceLane(board, laneId, (lane) => ({ ...lane, cards: [...lane.cards, card] }));
}

export function findCard(board, cardId) {
  for (const lane of board.lanes) {
    const card = lane.cards.find((c) => c.id === cardId);
    if (card) return { lane, card };
  }
  return null;
}

function requireCard(board, cardId) {
  const found = findCard(board, cardId);
  if (!found) throw new CardNotFound(cardId);
  return found;
}

export function updateCard(board, cardId, fn) {
  const { lane, card } = requireCard(board, cardId);
  const next = fn(card);
  return replaceLane(board, lane.id, (l) => ({
    ...l,
    cards: l.cards.map((c) => (c.id === cardId ? next : c)),
  }));
}

export function removeCard(board, cardId) {
  const { lane } = requireCard(board, cardId);
  return replaceLane(board, lane.id, (l) => ({
    ...l,
    cards: l.cards.filter((c) => c.id !== cardId),
  }));
}

export function moveCard(board, cardId, toLaneId, position) {
  const { card } = requireCard(board, cardId);
  findLane(board, toLaneId);
  const without = removeCard(board, cardId);
  return replaceLane(without, toLaneId, (lane) => {
    const index = Math.min(Math.max(Number.isInteger(position) ? position : lane.cards.length, 0), lane.cards.length);
    const cards = [...lane.cards];
    cards.splice(index, 0, card);
    return { ...lane, cards };
  });
}

// --- labels --------------------------------------------------------------

export function findLabel(board, labelId) {
  const label = board.labels.find((l) => l.id === labelId);
  if (!label) throw new LabelNotFound(labelId);
  return label;
}

function assertUniqueName(board, name, exceptId) {
  const clash = board.labels.find(
    (l) => l.id !== exceptId && l.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) throw new DuplicateLabelName(name);
}

export function createLabel(board, { id, name, color }) {
  const cleanName = requireNonEmpty(name, EmptyTitle);
  assertLabelColor(color);
  assertUniqueName(board, cleanName);
  return { ...board, labels: [...board.labels, { id, name: cleanName, color }] };
}

export function updateLabel(board, labelId, { name, color } = {}) {
  const current = findLabel(board, labelId);
  const next = { ...current };
  if (name !== undefined) {
    next.name = requireNonEmpty(name, EmptyTitle);
    assertUniqueName(board, next.name, labelId);
  }
  if (color !== undefined) next.color = assertLabelColor(color);
  return { ...board, labels: board.labels.map((l) => (l.id === labelId ? next : l)) };
}

export function deleteLabel(board, labelId) {
  findLabel(board, labelId);
  return {
    ...board,
    labels: board.labels.filter((l) => l.id !== labelId),
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((c) =>
        c.labelIds.includes(labelId)
          ? { ...c, labelIds: c.labelIds.filter((id) => id !== labelId) }
          : c,
      ),
    })),
  };
}

export function attachLabel(board, cardId, labelId, now) {
  findLabel(board, labelId);
  return updateCard(board, cardId, (card) => cardAddLabel(card, labelId, now));
}

export function detachLabel(board, cardId, labelId, now) {
  return updateCard(board, cardId, (card) => cardRemoveLabel(card, labelId, now));
}
