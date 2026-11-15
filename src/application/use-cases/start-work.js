import { updateCard } from "@/domain/board.js";
import { startWork as startWorkOnCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function startWork(deps, { cardId, location, branch, worktreePath, session }) {
  return mutateBoard(deps, (board, { clock }) =>
    updateCard(board, cardId, (card) => startWorkOnCard(card, { location, branch, worktreePath, session }, clock.now())),
  );
}
