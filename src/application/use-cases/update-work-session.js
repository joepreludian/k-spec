import { updateCard } from "@/domain/board.js";
import { updateWorkSession as updateSessionOnCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

/** Token/turn updates from an agent. Does not bump the card's updatedAt (see design). */
export function updateWorkSession(deps, { cardId, session }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => updateSessionOnCard(card, session, clock.now())),
  );
}
