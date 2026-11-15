import { updateCard } from "@/domain/board.js";
import { unpublishService as unpublishOnCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function unpublishService(deps, { cardId, serviceId }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => unpublishOnCard(card, serviceId, clock.now())),
  );
}
