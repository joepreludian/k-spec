import { moveCard as move } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function moveCard(deps, { cardId, toLaneId, position }) {
  return mutateBoard(deps, (board) => move(board, cardId, toLaneId, position));
}
