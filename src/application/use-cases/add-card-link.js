import { updateCard } from "@/domain/board.js";
import { addLink } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

/** Title defaults to the file's basename without its markdown extension. */
function defaultTitle(path) {
  return String(path ?? "")
    .trim()
    .split("/")
    .pop()
    .replace(/\.(md|markdown)$/i, "");
}

export function addCardLink(deps, { cardId, title, path }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    const cleanTitle = typeof title === "string" && title.trim() ? title : defaultTitle(path);
    return {
      board: updateCard(board, cardId, (card) => addLink(card, { id, title: cleanTitle, path }, clock.now())),
      id,
    };
  });
}
