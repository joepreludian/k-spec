import { systemClock } from "../clock.js";
import { randomIdGenerator } from "../id-generator.js";
import { DumpError } from "./board-dump.js";
import { createCommandQueue } from "./command-queue.js";
import { autoDumpEnabled, openStore, storePaths } from "./open-store.js";

// One store per server process. It lives on globalThis so dev hot reload, which re-evaluates
// this module, keeps using the same connection and the same queue.
const KEY = Symbol.for("k-spec.server-store");
const HOOK = Symbol.for("k-spec.shutdown-hook");

/**
 * The process's board store, opened on first use at `storePaths()`:
 * `{ repository, queue, deps, autoDump, saved(), dump(), close() }` where `deps` is what use cases take.
 *
 * `saved()` is what the command route calls after a command changed the board. With saving on
 * every change (`autoDump`) it writes the dump. It never throws: a dump that cannot be written
 * is logged and remembered (`unsaved`) until a later write succeeds.
 */
export function getServerStore() {
  if (!globalThis[KEY]) {
    const paths = storePaths();
    const store = openStore(paths);
    const state = {
      ...store,
      autoDump: autoDumpEnabled(),
      unsaved: false,
      queue: createCommandQueue(),
      deps: { repository: store.repository, clock: systemClock, idGenerator: randomIdGenerator },
    };
    state.saved = () => {
      if (!state.autoDump) return;
      try {
        store.dump();
        state.unsaved = false;
      } catch (error) {
        state.unsaved = true;
        console.error(`Could not write the board dump ${paths.dumpFile}`, error);
      }
    };
    globalThis[KEY] = state;
  }
  return globalThis[KEY];
}

/** One line for the server's start: where the board is saved, and when. */
export function savingNotice(env = process.env) {
  const { dumpFile } = storePaths(env);
  return autoDumpEnabled(env)
    ? `board saved to ${dumpFile} after every change`
    : `board saved to ${dumpFile} when the server stops (K_SPEC_AUTO_DUMP is off)`;
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
 *
 * With saving on every change the file already holds every change, so it is left alone: it may
 * have been replaced since (a git pull), and the next start must find that file, not this
 * server's board. The one exception is a change whose write failed.
 */
export function dumpOnShutdown() {
  const store = globalThis[KEY];
  if (!store) return false;
  if (store.autoDump && !store.unsaved) return false;
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

/**
 * Opens the store as the server starts, so a dump that cannot be imported stops the server
 * with the file named instead of failing every request later.
 */
export function startServerStore({ exit = (code) => process.exit(code) } = {}) {
  try {
    getServerStore();
  } catch (error) {
    if (!(error instanceof DumpError)) throw error;
    console.error(`\n  k-spec cannot start: ${error.message}: ${error.file}\n`);
    exit(1);
  }
}
