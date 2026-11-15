import { resolveProjectFile } from "./resolve-project-file.js";

export const MAX_FILE_BYTES = 1024 * 1024;

const ERRORS = { 400: "Invalid path", 403: "Not allowed", 404: "Not found", 413: "Too large" };
const fail = (status) => ({ status, body: { error: ERRORS[status] } });

/**
 * Reads one markdown file from the project. `fs` is `node:fs/promises` or a fake with
 * `stat(path)` → `{ size, isFile() }` and `readFile(path, "utf8")`.
 */
export async function readProjectFile({ rootDir, path, fs, maxBytes = MAX_FILE_BYTES }) {
  const resolved = resolveProjectFile(rootDir, path);
  if (!resolved.ok) return fail(resolved.status);
  let stat;
  try {
    stat = await fs.stat(resolved.absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return fail(404);
    throw error;
  }
  if (!stat.isFile()) return fail(404);
  if (stat.size > maxBytes) return fail(413);
  const content = await fs.readFile(resolved.absolutePath, "utf8");
  return { status: 200, body: { path: resolved.path, content } };
}
