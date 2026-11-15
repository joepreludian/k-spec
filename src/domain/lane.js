import { EmptyTitle } from "./errors.js";
import { requireNonEmpty } from "./text.js";

export function createLane({ id, name }) {
  return { id, name: requireNonEmpty(name, EmptyTitle), cards: [] };
}

export function renameLane(lane, name) {
  return { ...lane, name: requireNonEmpty(name, EmptyTitle) };
}
