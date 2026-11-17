import { boardFromFiles } from "./board-from-files.js";
import { KspecFormatError } from "./format.js";
import { readTree } from "./read-tree.js";
import { kspecVersion } from "./version.js";

/**
 * Reads the board from a kspec root. `{ status: 200, body: { board, version } }`, or
 * `{ status: 422, body: { error, file, version } }` when a file's content is wrong.
 * The version is taken before reading, so a change made meanwhile shows up on the next check.
 */
export async function loadBoard(rootDir) {
  const version = await kspecVersion(rootDir);
  try {
    return { status: 200, body: { board: boardFromFiles(await readTree(rootDir)), version } };
  } catch (error) {
    if (!(error instanceof KspecFormatError)) throw error;
    return { status: 422, body: { error: error.message, file: error.file, version } };
  }
}
