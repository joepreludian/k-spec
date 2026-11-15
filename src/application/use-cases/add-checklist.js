import { updateCard } from "@/domain/board.js";
import { addChecklist as add } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function addChecklist(deps, { cardId, title }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    return {
      board: updateCard(board, cardId, (card) => add(card, { id, title }, clock.now())),
      id,
    };
  });
}
