import { findCard } from "@/domain/board.js";

/** "card:<id>" | "lane:<id>" → { kind, id } | null */
export function parseDragId(dragId) {
  if (typeof dragId !== "string") return null;
  const i = dragId.indexOf(":");
  if (i <= 0) return null;
  const kind = dragId.slice(0, i);
  if (kind !== "card" && kind !== "lane") return null;
  return { kind, id: dragId.slice(i + 1) };
}

/**
 * Translate a dnd-kit drag end into a moveCard input, or null when nothing changes.
 * `overId` is a card id (insert at its index; after it when moving down within
 * the same lane, matching sortable semantics) or a lane id (append).
 */
export function computeCardDrop(board, { activeId, overId }) {
  const active = parseDragId(activeId);
  const over = parseDragId(overId);
  if (!active || !over || active.kind !== "card") return null;

  const source = findCard(board, active.id);
  if (!source) return null;
  const fromIndex = source.lane.cards.findIndex((c) => c.id === active.id);

  let toLaneId;
  let position;
  if (over.kind === "lane") {
    const lane = board.lanes.find((l) => l.id === over.id);
    if (!lane) return null;
    toLaneId = lane.id;
    position = lane.id === source.lane.id ? lane.cards.length - 1 : lane.cards.length;
  } else {
    if (over.id === active.id) return null;
    const target = findCard(board, over.id);
    if (!target) return null;
    toLaneId = target.lane.id;
    // Index of the hovered card. moveCard inserts after removing the active
    // card, so within the same lane this lands after the hovered card when
    // moving down and at its slot when moving up (sortable semantics).
    position = target.lane.cards.findIndex((c) => c.id === over.id);
  }

  if (toLaneId === source.lane.id && position === fromIndex) return null;
  return { cardId: active.id, toLaneId, position };
}

/** Translate a lane drag into a reorderLanes input, or null. */
export function computeLaneDrop(board, { activeId, overId }) {
  const active = parseDragId(activeId);
  const over = parseDragId(overId);
  if (!active || !over || active.kind !== "lane" || over.kind !== "lane") return null;
  if (active.id === over.id) return null;
  const ids = board.lanes.map((l) => l.id);
  const from = ids.indexOf(active.id);
  const to = ids.indexOf(over.id);
  if (from < 0 || to < 0) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, active.id);
  return { laneIds: next };
}
