import { updateCard } from "@/domain/board.js";
import { toggleChecklistItem as toggle } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function toggleChecklistItem(deps, { cardId, checklistId, itemId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => toggle(card, checklistId, itemId, clock.now())),
  );
}
