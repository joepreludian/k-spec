/**
 * Load the board, apply `fn(board, deps)`, persist, and return `{ board, ...extra }`.
 * `fn` may return a Board or `{ board, ...extra }` (creators add `id`).
 */
export async function mutateBoard(deps, fn) {
  const board = await deps.repository.load();
  const result = fn(board, deps);
  const next = result && result.board ? result : { board: result };
  await deps.repository.save(next.board);
  return next;
}
