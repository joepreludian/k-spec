import { attachLabel } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function addLabel(deps, { cardId, labelId }) {
  return mutateBoard(deps, (board, { clock }) => attachLabel(board, cardId, labelId, clock.now()));
}
