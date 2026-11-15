import { systemClock } from "./clock.js";
import { randomIdGenerator } from "./id-generator.js";
import { createInMemoryBoardRepository } from "./in-memory-board-repository.js";
import { createLocalCommandExecutor } from "./local-command-executor.js";
import { seedBoard } from "./seed-board.js";

/** The seed the browser session starts from; also the repository's initial state. */
export const initialBoard = seedBoard();

let executor;

/** Module-level singleton so every render shares one in-memory repository. */
export function createBrowserExecutor() {
  if (!executor) {
    executor = createLocalCommandExecutor({
      repository: createInMemoryBoardRepository(initialBoard),
      clock: systemClock,
      idGenerator: randomIdGenerator,
    });
  }
  return executor;
}
