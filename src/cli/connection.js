/** The CLI cannot tell where the server is, or how to get past its access gate. */
export class ConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConnectionError";
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

function fromNote(noteFile, readFile) {
  const unreadable = () => new ConnectionError(`cannot read the server note: ${noteFile}`);
  let content;
  try {
    content = readFile(noteFile);
  } catch {
    throw unreadable();
  }
  if (content === null) {
    throw new ConnectionError(
      `server not running (no ${noteFile}; start it with npm run dev, or set K_SPEC_URL and K_SPEC_TOKEN)`,
    );
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
 */
export function resolveConnection({ env, noteFile, readFile }) {
  if (!text(env.K_SPEC_URL)) return fromNote(noteFile, readFile);
  const token = text(env.K_SPEC_TOKEN);
  if (!token) throw new ConnectionError("K_SPEC_URL is set but K_SPEC_TOKEN is not");
  const url = address(env.K_SPEC_URL);
  if (!url) throw new ConnectionError("K_SPEC_URL is not an http(s) address");
  return { url, token };
}
