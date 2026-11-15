import { updateCard } from "@/domain/board.js";
import { updateDescription } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function updateCardDescription(deps, { cardId, description }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => updateDescription(card, description, clock.now())),
  );
}
