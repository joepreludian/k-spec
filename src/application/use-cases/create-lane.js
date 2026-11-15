import { addLane } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function createLane(deps, { name }) {
  return mutateBoard(deps, (board, { idGenerator }) => {
    const id = idGenerator.next();
    return { board: addLane(board, { id, name }), id };
  });
}
