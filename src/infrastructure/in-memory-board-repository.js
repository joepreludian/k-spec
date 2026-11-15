export function createInMemoryBoardRepository(initialBoard) {
  let board = structuredClone(initialBoard);
  return {
    async load() {
      return structuredClone(board);
    },
    async save(next) {
      board = structuredClone(next);
    },
  };
}
