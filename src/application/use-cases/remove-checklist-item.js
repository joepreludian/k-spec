import { updateCard } from "@/domain/board.js";
import { removeChecklistItem as remove } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function removeChecklistItem(deps, { cardId, checklistId, itemId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => remove(card, checklistId, itemId, clock.now())),
  );
}
