import { deleteLabel as remove } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function deleteLabel(deps, { labelId }) {
  return mutateBoard(deps, (board) => remove(board, labelId));
}
