import { addCardToLane } from "@/domain/board.js";
import { createCard as newCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function createCard(deps, { laneId, title }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    const card = newCard({ id, title, now: clock.now() });
    return { board: addCardToLane(board, laneId, card), id };
  });
}
