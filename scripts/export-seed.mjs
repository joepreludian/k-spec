// Writes the seed board as a kspec root: npm run export-seed [-- <dir>] [-- --force]
import path from "node:path";
import { seedFiles, writeFiles } from "../src/infrastructure/kspec/export-seed.js";

const args = process.argv.slice(2);
const force = args.includes("--force");
const target = path.resolve(args.find((a) => !a.startsWith("--")) ?? "kspec-root");

try {
  const files = seedFiles();
  await writeFiles(target, files, { force });
  console.log(`Wrote ${Object.keys(files).length} files to ${target}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
