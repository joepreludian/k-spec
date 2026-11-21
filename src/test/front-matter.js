/**
 * The fields of a skill's front matter, each value read the way YAML reads a one-line scalar.
 * That matters for a description: unquoted, it ends where a comment starts (white space, then
 * `#`), so `Use when the user says "k-spec #12" …` would reach the model as `Use when the user
 * says "k-spec`. Tests assert on what this returns, not on the raw line.
 */
export function frontMatter(text) {
  const [, block = ""] = text.match(/^---\n([\s\S]*?)\n---\n/) ?? [];
  const fields = {};
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = scalar(match[2]);
  }
  return fields;
}

function scalar(raw) {
  const text = raw.trim();
  const single = /^'((?:[^']|'')*)'/.exec(text);
  if (single) return single[1].replaceAll("''", "'");
  const double = /^"(?:[^"\\]|\\.)*"/.exec(text);
  if (double) return JSON.parse(double[0]);
  return text.replace(/\s+#.*$/, "");
}
