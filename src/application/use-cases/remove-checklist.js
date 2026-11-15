import { updateCard } from "@/domain/board.js";
import { removeChecklist as remove } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function removeChecklist(deps, { cardId, checklistId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => remove(card, checklistId, clock.now())),
  );
}
