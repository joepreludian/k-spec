import path from "node:path";
import { assertMarkdownPath } from "@/domain/markdown-path.js";
import { readProjectFile } from "../files/read-project-file.js";
import { CARD_FILE_PREFIX, cardNumberOf } from "./format.js";

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

/** The card's folder, wherever the card currently is: lanes are scanned for its number. */
async function findCardDir(rootDir, number, fs) {
  const lanesDir = path.join(rootDir, "lanes");
  let lanes;
  try {
    lanes = await fs.readdir(lanesDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
  for (const lane of lanes.filter((e) => e.isDirectory())) {
    const children = await fs.readdir(path.join(lanesDir, lane.name), { withFileTypes: true });
    const match = children.find((e) => e.isDirectory() && cardNumberOf(e.name) === number);
    if (match) return path.join(lanesDir, lane.name, match.name);
  }
  return null;
}

/**
 * Reads one markdown file from a card's `files/` folder. `path` is the link path
 * `kspec-cards/<number>/<file>`; the card is found by number, so the address survives a move
 * to another lane. Same result shape and limits as `readProjectFile`.
 */
export async function readCardFile({ rootDir, path: requested, fs, maxBytes }) {
  const parsed = parseCardFilePath(requested);
  if (!parsed) return fail(400, "Invalid path");
  const cardDir = await findCardDir(rootDir, parsed.number, fs);
  if (!cardDir) return fail(404, "Not found");
  const result = await readProjectFile({
    rootDir: path.join(cardDir, "files"),
    path: encodeURIComponent(parsed.name),
    fs,
    ...(maxBytes === undefined ? {} : { maxBytes }),
  });
  if (result.status !== 200) return result;
  return { status: 200, body: { ...result.body, path: `${CARD_FILE_PREFIX}/${parsed.number}/${parsed.name}` } };
}
