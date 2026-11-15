import { updateCard } from "@/domain/board.js";
import { setAgentStatus as setStatus } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function setAgentStatus(deps, { cardId, status }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => setStatus(card, status, clock.now())),
  );
}
