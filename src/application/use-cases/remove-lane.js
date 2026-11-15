import { removeLane as remove } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function removeLane(deps, { laneId }) {
  return mutateBoard(deps, (board) => remove(board, laneId));
}
