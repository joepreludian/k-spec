import { systemClock } from "./clock.js";
import { randomIdGenerator } from "./id-generator.js";
import { createInMemoryBoardRepository } from "./in-memory-board-repository.js";
import { createLocalCommandExecutor } from "./local-command-executor.js";

/**
 * An executor that runs commands in the browser against its own in-memory copy of `board`.
 * Nothing is written back to the kspec root yet, so edits last until the board is reloaded.
 */
export function createBrowserExecutor(board) {
  return createLocalCommandExecutor({
    repository: createInMemoryBoardRepository(board),
    clock: systemClock,
    idGenerator: randomIdGenerator,
  });
}
