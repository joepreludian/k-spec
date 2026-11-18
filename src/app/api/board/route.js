import { getServerStore } from "@/infrastructure/store/server-store.js";

/** GET /api/board → { board, version }: the stored board and the number of the save that produced it. */
export async function GET() {
  const { repository } = getServerStore();
  const body = { board: await repository.load(), version: repository.version() };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
