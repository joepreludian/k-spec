import { kspecRoot } from "@/infrastructure/kspec/kspec-root.js";
import { kspecVersion } from "@/infrastructure/kspec/version.js";

/** GET /api/board/version → { version }: cheap "has the kspec root changed?" check for the browser. */
export async function GET() {
  return Response.json({ version: await kspecVersion(kspecRoot()) }, { headers: { "Cache-Control": "no-store" } });
}
