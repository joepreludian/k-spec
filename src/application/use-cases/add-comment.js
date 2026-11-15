import { PERSON } from "@/domain/author.js";
import { updateCard } from "@/domain/board.js";
import { addComment as add } from "@/domain/card.js";
import { mutateBoard } from "../run-use-case.js";

export function addComment(deps, { cardId, body, author = PERSON }) {
  return mutateBoard(deps, (board, { idGenerator, clock }) => {
    const id = idGenerator.next();
    return {
      board: updateCard(board, cardId, (card) => add(card, { id, author, body }, clock.now())),
      id,
    };
  });
}
