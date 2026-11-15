export async function getBoard(deps) {
  return { board: await deps.repository.load() };
}
