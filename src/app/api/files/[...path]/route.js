import fs from "node:fs/promises";
import { projectDir } from "@/infrastructure/files/project-dir.js";
import { readProjectFile } from "@/infrastructure/files/read-project-file.js";

/** GET /api/files/<relative markdown path> → { path, content }, read-only, from the project dir. */
export async function GET(_request, { params }) {
  const { path: segments = [] } = await params;
  const { status, body } = await readProjectFile({ rootDir: projectDir(), path: segments.join("/"), fs });
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
