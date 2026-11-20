import { addLane, createBoard, setProject } from "@/domain/board.js";

/** The lanes every new board starts with: `[id, name]`, in order. */
export const STANDARD_LANES = Object.freeze([
  ["lane-backlog", "Backlog"],
  ["lane-todo", "Todo"],
  ["lane-in-progress", "In Progress"],
  ["lane-review", "Review"],
  ["lane-done", "Done"],
]);

/**
 * The first board of a project that has none yet: its name, the standard lanes, no cards and no
 * labels. Used instead of the sample board when the server is told the board's name
 * (`K_SPEC_BOARD_NAME`, which `k-spec init` sets for a project).
 */
export function starterBoard(name) {
  let board = setProject(createBoard({ id: "board-1", name }), { name });
  for (const [id, laneName] of STANDARD_LANES) board = addLane(board, { id, name: laneName });
  return board;
}
