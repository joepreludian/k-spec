// npm run db:dump: writes the stored board to the dump file (the state that goes into git).
import { openStore, storePaths } from "../src/infrastructure/store/open-store.js";

const paths = storePaths();
const store = openStore(paths);
try {
  store.dump();
  console.log(`Dumped the board to ${paths.dumpFile}`);
} finally {
  store.close();
}
