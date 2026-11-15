import { renameLane as rename } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function renameLane(deps, { laneId, name }) {
  return mutateBoard(deps, (board) => rename(board, laneId, name));
}
