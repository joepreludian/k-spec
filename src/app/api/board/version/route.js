import { getServerStore } from "@/infrastructure/store/server-store.js";

/** GET /api/board/version → { version }: cheap "has the board changed?" check for the browser. */
export async function GET() {
  return Response.json({ version: getServerStore().repository.version() }, { headers: { "Cache-Control": "no-store" } });
}
