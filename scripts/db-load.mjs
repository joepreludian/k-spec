// npm run db:load: replaces the stored board with the one in the dump file.
// Safe while the server runs: it is one transaction, and open browsers reload on their next check.
import { DumpError } from "../src/infrastructure/store/board-dump.js";
import { openStore, storePaths } from "../src/infrastructure/store/open-store.js";

const paths = storePaths();
let store;
try {
  store = openStore(paths);
  store.load();
  console.log(`Loaded the board from ${paths.dumpFile}`);
} catch (error) {
  if (!(error instanceof DumpError)) throw error;
  console.error(`${error.message}: ${error.file}`);
  process.exitCode = 1;
} finally {
  store?.close();
}
