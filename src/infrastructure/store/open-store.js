import fs from "node:fs";
import path from "node:path";
import { seedBoard } from "../seed-board.js";
import { dumpBoardSync, loadDumpSync } from "./board-dump.js";
import { openDatabase } from "./open-database.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

/** Where the database and its dump live: `K_SPEC_DB` / `K_SPEC_DUMP`, else `data/` under the working directory. */
export function storePaths(env = process.env, cwd = process.cwd()) {
  return {
    dbFile: env.K_SPEC_DB || path.join(cwd, "data", "k-spec.db"),
    dumpFile: env.K_SPEC_DUMP || path.join(cwd, "data", "k-spec.dump.json"),
  };
}

/**
 * Opens the board store. A database that holds no board yet is filled from the dump file when
 * there is one, otherwise with the sample board; a database that has a board never reads the dump.
 * Returns `{ repository, dump(), load(), close() }`; `dump` and `load` are the on-demand directions.
 */
export function openStore({ dbFile, dumpFile }) {
  const database = openDatabase(dbFile);
  const repository = createSqliteBoardRepository(database.db);
  const dump = () => dumpBoardSync({ repository, file: dumpFile });
  const load = () => loadDumpSync({ repository, file: dumpFile });
  try {
    if (repository.isEmpty()) {
      if (fs.existsSync(dumpFile)) load();
      else repository.replaceSync(seedBoard());
    }
  } catch (error) {
    database.close();
    throw error;
  }
  return { repository, dump, load, close: database.close };
}
