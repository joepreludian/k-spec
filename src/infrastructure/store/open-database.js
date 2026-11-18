import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MEMORY = ":memory:";

/** Where the generated migrations live (`npm run db:generate`). */
const migrationsFolder = () => path.join(process.cwd(), "drizzle");

/**
 * Opens (creating if needed) the SQLite database at `file` and brings its tables up to date.
 * Returns `{ db, close() }`; `db` is the Drizzle database, `db.$client` the raw connection.
 */
export function openDatabase(file) {
  if (file !== MEMORY) fs.mkdirSync(path.dirname(file), { recursive: true });
  const client = new Database(file);
  if (file !== MEMORY) client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  const db = drizzle(client);
  migrate(db, { migrationsFolder: migrationsFolder() });
  return { db, close: () => client.close() };
}
