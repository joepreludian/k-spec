import fs from "node:fs";
import path from "node:path";
import { seedBoard } from "../seed-board.js";
import { starterBoard } from "../starter-board.js";
import { dumpBoardSync, loadDumpSync } from "./board-dump.js";
import { openDatabase } from "./open-database.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

/**
 * Where the database and its dump live: `K_SPEC_DB` / `K_SPEC_DUMP`, else `data/` under the
 * working directory. `boardName` is `K_SPEC_BOARD_NAME`, the name of a project's first board, or null.
 */
export function storePaths(env = process.env, cwd = process.cwd()) {
  return {
    dbFile: env.K_SPEC_DB || path.join(cwd, "data", "k-spec.db"),
    dumpFile: env.K_SPEC_DUMP || path.join(cwd, "data", "k-spec.dump.json"),
    boardName: env.K_SPEC_BOARD_NAME?.trim() || null,
  };
}

/**
 * Opens the board store. A database that holds no board yet is filled from the dump file when
 * there is one; otherwise with an empty board called `boardName` when that is given, else with
 * the sample board. A database that has a board never reads the dump.
 * Returns `{ repository, dump(), load(), close() }`; `dump` and `load` are the on-demand directions.
 */
export function openStore({ dbFile, dumpFile, boardName = null }) {
  const database = openDatabase(dbFile);
  const repository = createSqliteBoardRepository(database.db);
  const dump = () => dumpBoardSync({ repository, file: dumpFile });
  const load = () => loadDumpSync({ repository, file: dumpFile });
  try {
    if (repository.isEmpty()) {
      if (fs.existsSync(dumpFile)) load();
      else repository.replaceSync(boardName ? starterBoard(boardName) : seedBoard());
    }
  } catch (error) {
    database.close();
    throw error;
  }
  return { repository, dump, load, close: database.close };
}
