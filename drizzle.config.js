import { defineConfig } from "drizzle-kit";

// Used by `npm run db:generate` to turn schema changes into migrations under ./drizzle.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infrastructure/store/schema.js",
  out: "./drizzle",
});
