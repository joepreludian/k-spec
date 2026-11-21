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

const OFF = new Set(["off", "0", "false", "no"]);

/**
 * Whether the server writes the dump after every change. It does, unless `K_SPEC_AUTO_DUMP`
 * says `off` (or `0`, `false`, `no`): then the dump is written when the server stops and on demand.
 */
export function autoDumpEnabled(env = process.env) {
  return !OFF.has((env.K_SPEC_AUTO_DUMP ?? "").trim().toLowerCase());
}

/**
 * Opens the board store. A database that holds no board yet is filled from the dump file when
 * there is one; otherwise with an empty board called `boardName` when that is given, else with
 * the sample board. A database that has a board never reads the dump, unless `startFromDump`
 * is set: then a dump that is there replaces the stored board, in one load. That is how a
 * server that saves on every change starts, the dump being the board and the database a cache.
 * `firstVersion()` is the version of the first board written into an empty database.
 * Returns `{ repository, dump(), load(), close() }`; `dump` and `load` are the on-demand directions.
 */
export function openStore({ dbFile, dumpFile, boardName = null, startFromDump = false, firstVersion }) {
  const database = openDatabase(dbFile);
  const repository = createSqliteBoardRepository(database.db, firstVersion ? { firstVersion } : {});
  const dump = () => dumpBoardSync({ repository, file: dumpFile });
  const load = () => loadDumpSync({ repository, file: dumpFile });
  try {
    if (fs.existsSync(dumpFile) && (startFromDump || repository.isEmpty())) load();
    else if (repository.isEmpty()) repository.replaceSync(boardName ? starterBoard(boardName) : seedBoard());
  } catch (error) {
    database.close();
    throw error;
  }
  return { repository, dump, load, close: database.close };
}
