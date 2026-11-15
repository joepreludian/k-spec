import { setProject as setProjectOnBoard } from "@/domain/board.js";
import { mutateBoard } from "../run-use-case.js";

/** Sets the board's project block; links without an id get one. */
export function setProject(deps, { name, links = [], readmePath = null }) {
  return mutateBoard(deps, (board, { idGenerator }) =>
    setProjectOnBoard(board, {
      name,
      links: links.map((l) => ({ ...l, id: l.id ?? idGenerator.next() })),
      readmePath,
    }),
  );
}
