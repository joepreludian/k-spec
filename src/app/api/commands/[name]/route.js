import { runCommand } from "@/infrastructure/store/run-command.js";
import { getServerStore } from "@/infrastructure/store/server-store.js";

/**
 * POST /api/commands/<name> with the command's input as a JSON object.
 * 200 { ...result, version } · 422 { error, code } · 404 · 400 · 415 · 500 (see runCommand).
 */
export async function POST(request, { params }) {
  const { name } = await params;
  const { deps, queue, saved } = getServerStore();
  const { status, body } = await runCommand({
    deps,
    queue,
    saved,
    name,
    contentType: request.headers.get("content-type"),
    text: await request.text(),
  });
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
