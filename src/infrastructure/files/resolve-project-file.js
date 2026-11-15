import path from "node:path";
import { assertMarkdownPath } from "@/domain/markdown-path.js";

/**
 * Turns a requested (possibly percent-encoded) relative path into an absolute path
 * under `rootDir`. 400 when the path breaks the markdown-path rule or is malformed,
 * 403 when it would resolve outside the root.
 */
export function resolveProjectFile(rootDir, requestedPath) {
  let decoded;
  try {
    decoded = assertMarkdownPath(decodeURIComponent(String(requestedPath ?? "")));
  } catch {
    return { ok: false, status: 400 };
  }
  const root = path.resolve(rootDir);
  const absolutePath = path.resolve(root, decoded);
  if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) return { ok: false, status: 403 };
  return { ok: true, path: decoded, absolutePath };
}
