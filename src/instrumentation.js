/** Runs once when the Next.js server starts: prints the access link, leaves the CLI its note, opens the store and says how the board is saved. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolveToken } = await import("./infrastructure/access/token.js");
  const token = resolveToken();
  const host = process.env.K_SPEC_HOST ?? "localhost";
  const port = process.env.PORT ?? "3000";
  console.log(`\n  k-spec board: http://${host}:${port}/?token=${token}\n`);

  // Leave the CLI a note with this server's address and token; it is removed on exit.
  const { announceServer } = await import("./infrastructure/server-note.js");
  announceServer({ token });

  // Open the board store now: a dump that cannot be imported stops the server here, file named.
  const { registerShutdownDump, savingNotice, startServerStore } = await import("./infrastructure/store/server-store.js");
  startServerStore();
  console.log(`  ${savingNotice()}\n`);
  // With saving on every change the dump is written after each command; the exit hook writes
  // it when that is off, or when a write had failed.
  registerShutdownDump();
}
