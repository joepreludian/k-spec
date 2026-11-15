import { updateCard } from "@/domain/board.js";
import { addChecklistItem as add } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function addChecklistItem(deps, { cardId, checklistId, text }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    return {
      board: updateCard(board, cardId, (card) => add(card, checklistId, { id, text }, clock.now())),
      id,
    };
  });
}
