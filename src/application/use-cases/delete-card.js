import { removeCard } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function deleteCard(deps, { cardId }) {
  return mutateBoard(deps, (board) => removeCard(board, cardId));
}
