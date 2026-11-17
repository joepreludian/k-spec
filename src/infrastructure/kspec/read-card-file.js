import path from "node:path";
import { assertMarkdownPath } from "@/domain/markdown-path.js";
import { readProjectFile } from "../files/read-project-file.js";
import { CARD_FILE_PREFIX, LANES, cardNumberOf } from "./format.js";

const fail = (status, error) => ({ status, body: { error } });

/** `kspec-cards/<number>/<file>` → `{ number, name }`, or null when the path is anything else. */
function parseCardFilePath(requested) {
  let segments;
  try {
    segments = assertMarkdownPath(decodeURIComponent(String(requested ?? ""))).split("/");
  } catch {
    return null;
  }
  const [prefix, number, name] = segments;
  if (segments.length !== 3 || prefix !== CARD_FILE_PREFIX || !/^[1-9]\d*$/.test(number)) return null;
  return { number: Number(number), name };
}

const missing = (error) => error?.code === "ENOENT" || error?.code === "ENOTDIR";

/** The card's folder, wherever the card currently is: the fixed lanes are scanned for its number. */
async function findCardDir(rootDir, number, fs) {
  for (const { folder } of LANES) {
    const laneDir = path.join(rootDir, "lanes", folder);
    let children;
    try {
      children = await fs.readdir(laneDir, { withFileTypes: true });
    } catch (error) {
      if (missing(error)) continue;
      throw error;
    }
    const match = children.find((e) => e.isDirectory() && cardNumberOf(e.name) === number);
    if (match) return path.join(laneDir, match.name);
  }
  return null;
}

/** True when `name`, with symlinks resolved, is still a file inside the card's own `files/` folder. */
async function staysInside(cardDir, name, fs) {
  try {
    const filesDir = path.join(await fs.realpath(cardDir), "files");
    const target = await fs.realpath(path.join(cardDir, "files", name));
    return target.startsWith(filesDir + path.sep);
  } catch (error) {
    if (missing(error)) return true; // nothing there: the read below answers 404
    throw error;
  }
}

/**
 * Reads one markdown file from a card's `files/` folder. `path` is the link path
 * `kspec-cards/<number>/<file>`; the card is found by number, so the address survives a move
 * to another lane. Symlinks that lead out of that folder are refused. Same result shape and limits as `readProjectFile`.
 */
export async function readCardFile({ rootDir, path: requested, fs, maxBytes }) {
  const parsed = parseCardFilePath(requested);
  if (!parsed) return fail(400, "Invalid path");
  const cardDir = await findCardDir(rootDir, parsed.number, fs);
  if (!cardDir) return fail(404, "Not found");
  if (!(await staysInside(cardDir, parsed.name, fs))) return fail(403, "Not allowed");
  const result = await readProjectFile({
    rootDir: path.join(cardDir, "files"),
    path: encodeURIComponent(parsed.name),
    fs,
    ...(maxBytes === undefined ? {} : { maxBytes }),
  });
  if (result.status !== 200) return result;
  return { status: 200, body: { ...result.body, path: `${CARD_FILE_PREFIX}/${parsed.number}/${parsed.name}` } };
}
