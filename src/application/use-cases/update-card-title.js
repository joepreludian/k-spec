import { updateCard } from "@/domain/board.js";
import { renameCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function updateCardTitle(deps, { cardId, title }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => renameCard(card, title, clock.now())),
  );
}
