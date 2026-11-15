import { createInMemoryBoardRepository } from "@/infrastructure/in-memory-board-repository.js";
import { fixedClock } from "@/infrastructure/clock.js";
import { sequentialIdGenerator } from "@/infrastructure/id-generator.js";

export const T0 = "2026-11-14T10:00:00.000Z";

/** Test-only deps: in-memory repo seeded with `board`, fixed clock, sequential ids. */
export function makeDeps(board) {
  return {
    repository: createInMemoryBoardRepository(board),
    clock: fixedClock(T0),
    idGenerator: sequentialIdGenerator(),
  };
}
