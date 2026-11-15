import { createLabel as newLabel } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

export function createLabel(deps, { name, color }) {
  return mutateBoard(deps, (board, { idGenerator }) => {
    const id = idGenerator.next();
    return { board: newLabel(board, { id, name, color }), id };
  });
}
