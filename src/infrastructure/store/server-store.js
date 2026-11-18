import { systemClock } from "../clock.js";
import { randomIdGenerator } from "../id-generator.js";
import { createCommandQueue } from "./command-queue.js";
import { openStore, storePaths } from "./open-store.js";

// One store per server process. It lives on globalThis so dev hot reload, which re-evaluates
// this module, keeps using the same connection and the same queue.
const KEY = Symbol.for("k-spec.server-store");
const HOOK = Symbol.for("k-spec.shutdown-hook");

/**
 * The process's board store, opened on first use at `storePaths()`:
 * `{ repository, queue, deps, dump(), close() }` where `deps` is what use cases take.
 */
export function getServerStore() {
  if (!globalThis[KEY]) {
    const store = openStore(storePaths());
    globalThis[KEY] = {
      ...store,
      queue: createCommandQueue(),
      deps: { repository: store.repository, clock: systemClock, idGenerator: randomIdGenerator },
    };
  }
  return globalThis[KEY];
}

/** Closes and forgets the store (tests). */
export function resetServerStore() {
  globalThis[KEY]?.close();
  delete globalThis[KEY];
}

/**
 * Writes the dump as the server goes down, if this process ever opened the store (it never
 * opens the database just to dump). Synchronous, so it can run from an exit handler; a failure
 * is logged and swallowed. Returns whether a dump was attempted.
 */
export function dumpOnShutdown() {
  const store = globalThis[KEY];
  if (!store) return false;
  try {
    store.dump();
  } catch (error) {
    console.error("Could not write the board dump on shutdown", error);
  }
  return true;
}

/** Arranges `dumpOnShutdown` to run when the process exits (Ctrl-C, SIGTERM, a normal stop). Once per process. */
export function registerShutdownDump() {
  if (globalThis[HOOK]) return;
  globalThis[HOOK] = true;
  process.on("exit", () => dumpOnShutdown());
}
