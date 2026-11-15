import { addNewCard } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function createCard(deps, { laneId, title }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    const { board: next } = addNewCard(board, laneId, { id, title, now: clock.now() });
    return { board: next, id };
  });
}
