import { filePageUrl } from "./file-urls.js";

const MARKDOWN_FILE = /\.(md|markdown)$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** POSIX-style join + normalise; returns null when the result escapes the root. */
function resolveRelative(baseDir, href) {
  const out = baseDir ? baseDir.split("/").filter(Boolean) : [];
  for (const seg of href.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join("/");
}

/**
 * Decide what an `href` inside rendered markdown becomes:
 * - external (http/https): `{ kind: "external" }`, opened in a new tab
 * - relative markdown file with a known `basePath`: `{ kind: "internal", href: "/files/<resolved>" }`
 * - relative markdown that escapes the project root: `{ kind: "plain" }` (rendered as text)
 * - everything else (anchors, absolute, images, no basePath): `{ kind: "other" }`, left alone
 */
export function rewriteMarkdownHref(href, basePath) {
  const raw = typeof href === "string" ? href : "";
  if (/^https?:\/\//i.test(raw)) return { href: raw, kind: "external" };
  const relativeMarkdown =
    raw && basePath && !HAS_SCHEME.test(raw) && !raw.startsWith("/") && !raw.startsWith("#") && MARKDOWN_FILE.test(raw.split("#")[0]);
  if (!relativeMarkdown) return { href: raw, kind: "other" };
  const baseDir = basePath.includes("/") ? basePath.slice(0, basePath.lastIndexOf("/")) : "";
  const resolved = resolveRelative(baseDir, raw.split("#")[0]);
  if (resolved === null) return { href: raw, kind: "plain" };
  return { href: filePageUrl(resolved), kind: "internal" };
}
