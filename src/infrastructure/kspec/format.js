/** The on-disk format of `kspec-root`: names, slugs and key spelling shared by reader and writer. */

/** Fixed lanes, in board order. Each has a meaning for the agent workflow, so they are not data. */
export const LANES = Object.freeze([
  { folder: "backlog", id: "lane-backlog", name: "Backlog" },
  { folder: "todo", id: "lane-todo", name: "Todo" },
  { folder: "in_progress", id: "lane-in-progress", name: "In Progress" },
  { folder: "review", id: "lane-review", name: "Review" },
  { folder: "done", id: "lane-done", name: "Done" },
]);

/** First path segment of a card file's link path: `kspec-cards/<number>/<file>`. */
export const CARD_FILE_PREFIX = "kspec-cards";

export const MARKDOWN_FILE = /\.(md|markdown)$/i;

/** A read failed because of what a file contains. `file` is relative to the kspec root. */
export class KspecFormatError extends Error {
  constructor(message, file) {
    super(message);
    this.name = "KspecFormatError";
    this.file = file;
  }
}

const SLUG_MAX = 40;

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/_+$/, "");
}

/** The card number a folder name starts with (`3_title` or `3`), or null. */
export function cardNumberOf(dirName) {
  const match = /^([1-9]\d*)(?:_|$)/.exec(dirName);
  return match ? Number(match[1]) : null;
}

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

const mapKeys = (fn) =>
  function convert(value) {
    if (Array.isArray(value)) return value.map(convert);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), convert(v)]));
  };

export const toCamel = mapKeys((k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()));
export const toSnake = mapKeys((k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
