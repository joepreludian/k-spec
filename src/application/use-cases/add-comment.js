import { PERSON } from "@/domain/author.js";
import { updateCard } from "@/domain/board.js";
import { addComment as add } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

/** Adds a comment to a card; `request: true` sends it as a request to the agent. */
export function addComment(deps, { cardId, body, author = PERSON, request = false }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    return {
      board: updateCard(board, cardId, (card) => add(card, { id, author, body, request }, clock.now())),
      id,
    };
  });
}
