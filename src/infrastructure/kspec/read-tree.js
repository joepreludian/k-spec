import fs from "node:fs/promises";
import path from "node:path";
import { cardNumberOf } from "./format.js";

const missing = (error) => error?.code === "ENOENT" || error?.code === "ENOTDIR";

async function readText(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (missing(error) || error?.code === "EISDIR") return null;
    throw error;
  }
}

async function entries(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
}

async function readCard(laneDir, dir) {
  const cardFile = path.join(laneDir, dir, "card.yaml");
  const [cardYaml, files, stat] = await Promise.all([
    readText(cardFile),
    entries(path.join(laneDir, dir, "files")),
    fs.stat(cardFile).catch(() => fs.stat(path.join(laneDir, dir))),
  ]);
  return {
    dir,
    cardYaml,
    modifiedAt: stat.mtime.toISOString(),
    files: files.filter((e) => e.isFile()).map((e) => e.name),
  };
}

/**
 * Reads a kspec root into the tree `boardFromFiles` takes. It parses nothing: file texts go in
 * as they are. A lane is any directory under `lanes/`; a card is any directory in a lane whose
 * name starts with a card number. A missing root is an empty tree.
 */
export async function readTree(rootDir) {
  const lanesDir = path.join(rootDir, "lanes");
  const [boardYaml, laneEntries] = await Promise.all([
    readText(path.join(rootDir, "board.yaml")),
    entries(lanesDir),
  ]);
  const lanes = {};
  await Promise.all(
    laneEntries
      .filter((e) => e.isDirectory())
      .map(async ({ name }) => {
        const laneDir = path.join(lanesDir, name);
        const [cardsYaml, children] = await Promise.all([
          readText(path.join(laneDir, "cards.yaml")),
          entries(laneDir),
        ]);
        const cardDirs = children.filter((e) => e.isDirectory() && cardNumberOf(e.name) !== null);
        lanes[name] = {
          cardsYaml,
          cards: await Promise.all(cardDirs.map((e) => readCard(laneDir, e.name))),
        };
      }),
  );
  return { boardYaml, lanes };
}
