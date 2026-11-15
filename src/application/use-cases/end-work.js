import { updateCard } from "@/domain/board.js";
import { endWork as endWorkOnCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function endWork(deps, { cardId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => endWorkOnCard(card, clock.now())),
  );
}
