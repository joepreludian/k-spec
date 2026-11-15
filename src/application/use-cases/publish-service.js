import { updateCard } from "@/domain/board.js";
import { publishService as publishOnCard } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

/** Publishes something a person can open on the card's active work; returns `{ board, id }`. */
export function publishService(deps, { cardId, url, title }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    return { board: updateCard(board, cardId, (card) => publishOnCard(card, { id, title, url }, clock.now())), id };
  });
}
