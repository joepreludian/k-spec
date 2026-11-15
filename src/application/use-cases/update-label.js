import { updateLabel as update } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function updateLabel(deps, { labelId, name, color }) {
  return mutateBoard(deps, (board) => update(board, labelId, { name, color }));
}
