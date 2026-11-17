import { kspecRoot } from "@/infrastructure/kspec/kspec-root.js";
import { loadBoard } from "@/infrastructure/kspec/load-board.js";

/** GET /api/board → { board, version } read from the kspec root; 422 { error, file, version } when a file is wrong. */
export async function GET() {
  const { status, body } = await loadBoard(kspecRoot());
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
