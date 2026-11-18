import { getServerStore } from "@/infrastructure/store/server-store.js";

/** GET /api/board → { board, version }: the stored board and the number of the save that produced it. */
export async function GET() {
  // Board and version are read together: a command saving in between must not pair them wrongly.
  return Response.json(getServerStore().repository.snapshotSync(), { headers: { "Cache-Control": "no-store" } });
}
