import { updateCard } from "@/domain/board.js";
import { removeLink } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function removeCardLink(deps, { cardId, linkId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => removeLink(card, linkId, clock.now())),
  );
}
