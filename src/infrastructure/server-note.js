import fs from "node:fs";
import path from "node:path";

// The running server leaves a note with its address and access token, so the CLI started in
// the same folder can reach it without being told. Node only: never import from the browser.
const HOOK = Symbol.for("k-spec.server-note-hook");

/** Where the note lives: `K_SPEC_SERVER_FILE`, else `data/k-spec.server.json` under the working directory. */
export function serverNotePath(env = process.env, cwd = process.cwd()) {
  return env.K_SPEC_SERVER_FILE || path.join(cwd, "data", "k-spec.server.json");
}

/** Writes `{ url, token, pid }`, readable by its owner only (it holds the token). */
export function writeServerNote({ file, url, token, pid }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ url, token, pid }, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600); // `mode` only applies when the file is created
}

/** Removes the note if `pid` wrote it, so a second process in the folder leaves a live server's note alone. Never throws. */
export function removeServerNote({ file, pid }) {
  try {
    if (JSON.parse(fs.readFileSync(file, "utf8")).pid !== pid) return false;
    fs.rmSync(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes the note as the server starts and arranges its removal when the process exits (once
 * per process). The address is `localhost`: whoever can read the file is on this machine.
 * `K_SPEC_NOTE_URL` replaces it where that is not how the reader reaches the server (a board in
 * a container is reached by its service name from the containers that run the CLI).
 * A note that cannot be written is logged, not fatal: the board still works in the browser.
 */
export function announceServer({ env = process.env, cwd = process.cwd(), token, pid = process.pid, on = process.on.bind(process) }) {
  const file = serverNotePath(env, cwd);
  try {
    writeServerNote({ file, url: env.K_SPEC_NOTE_URL?.trim() || `http://localhost:${env.PORT ?? "3000"}`, token, pid });
  } catch (error) {
    console.error(`Could not write the server note ${file}`, error);
    return file;
  }
  if (!globalThis[HOOK]) {
    globalThis[HOOK] = true;
    on("exit", () => removeServerNote({ file, pid }));
  }
  return file;
}
