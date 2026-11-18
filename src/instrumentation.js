/** Runs once when the Next.js server starts: prints the access link and arranges the dump on shutdown. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolveToken } = await import("./infrastructure/access/token.js");
  const token = resolveToken();
  const host = process.env.K_SPEC_HOST ?? "localhost";
  const port = process.env.PORT ?? "3000";
  console.log(`\n  k-spec board: http://${host}:${port}/?token=${token}\n`);

  // The board dump is written when the server stops (and on demand with `npm run db:dump`).
  const { registerShutdownDump } = await import("./infrastructure/store/server-store.js");
  registerShutdownDump();
}
