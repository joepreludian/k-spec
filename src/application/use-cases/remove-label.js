import { detachLabel } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function removeLabel(deps, { cardId, labelId }) {
  return mutateBoard(deps, (board, { clock }) => detachLabel(board, cardId, labelId, clock.now()));
}
