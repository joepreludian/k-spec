import fs from "node:fs";
import path from "node:path";

export const DUMP_FORMAT = 1;

/** The dump file could not be read, understood or stored. `file` is its path. */
export class DumpError extends Error {
  constructor(message, file) {
    super(message);
    this.name = "DumpError";
    this.file = file;
  }
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** Same value with object keys in alphabetical order at every level; arrays keep their order. */
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sorted(value[key])]),
  );
}

/** The dump text for a board: stable (same board, same bytes) and diff-friendly. */
export function serializeDump(board) {
  return `${JSON.stringify(sorted({ format: DUMP_FORMAT, board }), null, 2)}\n`;
}

/** The board inside a dump text; throws `DumpError` when the text is not a dump this version reads. */
export function parseDump(text, file) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DumpError("Dump is not valid JSON", file);
  }
  if (!isObject(parsed)) throw new DumpError("Dump has no board", file);
  if (parsed.format !== DUMP_FORMAT) throw new DumpError(`Unsupported dump format: ${parsed.format}`, file);
  if (!isObject(parsed.board)) throw new DumpError("Dump has no board", file);
  return parsed.board;
}

/** Writes the stored board to `file` (temp file, then rename, so readers never see half a dump). */
export function dumpBoardSync({ repository, file }) {
  const text = serializeDump(repository.readSync());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

/** Replaces the stored board with the one in `file`. On any failure the stored board is untouched. */
export function loadDumpSync({ repository, file }) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new DumpError("Dump file not found", file);
    throw new DumpError("Dump file could not be read", file);
  }
  const board = parseDump(text, file);
  try {
    repository.replaceSync(board);
  } catch (cause) {
    throw Object.assign(new DumpError("Dump could not be stored", file), { cause });
  }
}
