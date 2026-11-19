/** The CLI cannot tell where the server is, or how to get past its access gate. */
export class ConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConnectionError";
  }
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

function fromNote(noteFile, readFile) {
  const content = readFile(noteFile);
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
  if (!text(note?.url) || !text(note?.token)) throw new ConnectionError(`cannot read the server note: ${noteFile}`);
  return { url: note.url, token: note.token };
}

/**
 * Where the server is and its token: `{ url, token }`.
 * `K_SPEC_URL` (with `K_SPEC_TOKEN`) when set; otherwise the note the running server leaves at
 * `noteFile`. `K_SPEC_TOKEN` on its own is the server's "fix the token" setting, so it is ignored.
 * `readFile(path)` returns the file's text, or null when there is no such file.
 */
export function resolveConnection({ env, noteFile, readFile }) {
  const url = text(env.K_SPEC_URL);
  let found;
  if (url) {
    const token = text(env.K_SPEC_TOKEN);
    if (!token) throw new ConnectionError("K_SPEC_URL is set but K_SPEC_TOKEN is not");
    found = { url, token };
  } else {
    found = fromNote(noteFile, readFile);
  }
  return { url: found.url.trim().replace(/\/+$/, ""), token: found.token };
}
