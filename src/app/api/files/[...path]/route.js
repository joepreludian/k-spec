import fs from "node:fs/promises";
import { projectDir } from "@/infrastructure/files/project-dir.js";
import { readProjectFile } from "@/infrastructure/files/read-project-file.js";
import { CARD_FILE_PREFIX } from "@/infrastructure/kspec/format.js";
import { kspecRoot } from "@/infrastructure/kspec/kspec-root.js";
import { readCardFile } from "@/infrastructure/kspec/read-card-file.js";

/**
 * GET /api/files/<relative markdown path> → { path, content }. Read-only. A path starting with
 * `kspec-cards/<number>/` is a file in that card's folder in the kspec root; anything else is
 * read from the project dir.
 */
export async function GET(_request, { params }) {
  const { path: segments = [] } = await params;
  const path = segments.join("/");
  const { status, body } =
    segments[0] === CARD_FILE_PREFIX
      ? await readCardFile({ rootDir: kspecRoot(), path, fs })
      : await readProjectFile({ rootDir: projectDir(), path, fs });
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
