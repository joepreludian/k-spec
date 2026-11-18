import { systemClock } from "../clock.js";
import { randomIdGenerator } from "../id-generator.js";
import { createCommandQueue } from "./command-queue.js";
import { openStore, storePaths } from "./open-store.js";

// One store per server process. It lives on globalThis so dev hot reload, which re-evaluates
// this module, keeps using the same connection and the same queue.
const KEY = Symbol.for("k-spec.server-store");

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
