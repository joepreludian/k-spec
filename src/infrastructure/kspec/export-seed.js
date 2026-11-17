import fs from "node:fs/promises";
import path from "node:path";
import { seedBoard } from "../seed-board.js";
import { boardToFiles, cardDir } from "./board-to-files.js";
import { slugify } from "./format.js";

/**
 * The seed board as kspec-root file contents. The seed's links point at git-ignored docs, so
 * each one becomes a small stub markdown file in its card's `files/` folder.
 */
export function seedFiles() {
  const board = seedBoard();
  const files = boardToFiles(board);
  for (const lane of board.lanes) {
    for (const card of lane.cards) {
      for (const link of card.links) {
        files[`${cardDir(lane, card)}/files/${slugify(link.title)}.md`] =
          `# ${link.title}\n\nSample data exported from the seed.\n`;
      }
    }
  }
  return files;
}

async function isEmptyOrMissing(dir) {
  try {
    return (await fs.readdir(dir)).length === 0;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

/**
 * Writes a `{ relativePath: content }` map under `targetDir`. A folder that already has
 * content is refused unless `force`, which replaces everything in it, and only when it is a kspec root.
 */
export async function writeFiles(targetDir, files, { force = false } = {}) {
  if (!(await isEmptyOrMissing(targetDir))) {
    if (!force) throw new Error(`${targetDir} is not empty; pass --force to replace it`);
    const present = await fs.readdir(targetDir);
    if (!present.includes("board.yaml") && !present.includes("lanes")) {
      throw new Error(`${targetDir} does not look like a kspec root (no board.yaml or lanes/); not replacing it`);
    }
    await fs.rm(targetDir, { recursive: true, force: true });
  }
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(targetDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
}
