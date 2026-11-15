import { InvalidLinkPath } from "./errors.js";

const MARKDOWN_FILE = /\.(md|markdown)$/i;

/**
 * A relative, forward-slash path to a markdown file inside the project:
 * no leading `/`, no `\`, no empty, `.` or `..` segments, `.md`/`.markdown` extension.
 * Returns the trimmed path; throws InvalidLinkPath otherwise.
 */
export function assertMarkdownPath(path) {
  const clean = typeof path === "string" ? path.trim() : "";
  const segments = clean.split("/");
  const valid =
    clean.length > 0 &&
    !clean.includes("\\") &&
    !clean.startsWith("/") &&
    segments.every((s) => s.length > 0 && s !== "." && s !== "..") &&
    MARKDOWN_FILE.test(segments.at(-1));
  if (!valid) throw new InvalidLinkPath(path);
  return clean;
}
