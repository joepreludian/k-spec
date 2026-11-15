import { reorderLanes as reorder } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function reorderLanes(deps, { laneIds }) {
  return mutateBoard(deps, (board) => reorder(board, laneIds));
}
