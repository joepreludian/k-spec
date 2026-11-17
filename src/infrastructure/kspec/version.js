import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Version of a root that does not exist. */
export const EMPTY_VERSION = "empty";

/**
 * A cheap fingerprint of the kspec root: a hash over the path, size and modification time of
 * every file under it. Nothing is parsed, so the browser can ask for it every few seconds.
 */
export async function kspecVersion(rootDir) {
  let found;
  try {
    found = await fs.readdir(rootDir, { withFileTypes: true, recursive: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return EMPTY_VERSION;
    throw error;
  }
  const lines = await Promise.all(
    found
      .filter((e) => e.isFile())
      .map(async (e) => {
        const file = path.join(e.parentPath, e.name);
        try {
          const stat = await fs.stat(file);
          return `${path.relative(rootDir, file)}|${stat.size}|${stat.mtimeMs}`;
        } catch {
          return null; // removed between listing and stat; the next check sees the new state
        }
      }),
  );
  return createHash("sha1").update(lines.filter(Boolean).sort().join("\n")).digest("hex");
}
