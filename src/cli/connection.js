/**
 * The CLI cannot tell where the server is, or how to get past its access gate. `transient` is
 * true when waiting can fix it (the server's note is not there yet, or is being written) and
 * false when only the caller can (the environment variables are wrong).
 */
export class ConnectionError extends Error {
  constructor(message, { transient = false } = {}) {
    super(message);
    this.name = "ConnectionError";
    this.transient = transient;
  }
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** The address without query or fragment (a pasted access link carries a token there), or null if it is not http(s). */
function address(value) {
  let parsed;
  try {
    parsed = new URL(text(value));
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

function fromNote(noteFile, readFile, startHint) {
  const unreadable = () => new ConnectionError(`cannot read the server note: ${noteFile}`, { transient: true });
  let content;
  try {
    content = readFile(noteFile);
  } catch {
    throw unreadable();
  }
  if (content === null) {
    const how = startHint || "npm run dev, or set K_SPEC_URL and K_SPEC_TOKEN";
    throw new ConnectionError(`server not running (no ${noteFile}; start it with ${how})`, { transient: true });
  }
  let note;
  try {
    note = JSON.parse(content);
  } catch {
    note = null;
  }
  const url = address(note?.url);
  if (!url || !text(note?.token)) throw unreadable();
  return { url, token: note.token };
}

/**
 * Where the server is and its token: `{ url, token }`.
 * `K_SPEC_URL` (with `K_SPEC_TOKEN`) when set; otherwise the note the running server leaves at
 * `noteFile`. `K_SPEC_TOKEN` on its own is the server's "fix the token" setting, so it is ignored.
 * `readFile(path)` returns the file's text, or null when there is no such file.
 * `K_SPEC_START_HINT` is how the server is started where the CLI runs, for the "not running"
 * message: a project's launcher sets it, because there the answer is not `npm run dev`.
 */
export function resolveConnection({ env, noteFile, readFile }) {
  if (!text(env.K_SPEC_URL)) return fromNote(noteFile, readFile, text(env.K_SPEC_START_HINT));
  const token = text(env.K_SPEC_TOKEN);
  if (!token) throw new ConnectionError("K_SPEC_URL is set but K_SPEC_TOKEN is not");
  const url = address(env.K_SPEC_URL);
  if (!url) throw new ConnectionError("K_SPEC_URL is not an http(s) address");
  return { url, token };
}

const UNANSWERED = {
  unreachable: (url) => `server not answering at ${url}`,
  rejected: (url) => `token rejected by ${url}`,
};

/**
 * What to tell the caller when `error` means "no connection": a `ConnectionError`'s own message,
 * or, for a request to `url` the server did not answer as itself (the executor's `CommandFailed`,
 * recognised by name so this module needs nothing from infrastructure), which way it failed.
 * Null for any other error.
 */
export function connectionTrouble(error, url) {
  if (error instanceof ConnectionError) return error.message;
  if (error?.name !== "CommandFailed") return null;
  return (UNANSWERED[error.reason] ?? ((address) => `unexpected answer from ${address}`))(url);
}
