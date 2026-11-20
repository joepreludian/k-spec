import { DomainError } from "@/domain/errors.js";

/**
 * The server did not answer the request: `reason` is `unreachable` (no answer at all),
 * `rejected` (the access gate redirected instead), `unknown-command` (404 from the commands
 * endpoint) or `unexpected` (anything else that is not our answer).
 */
export class CommandFailed extends Error {
  constructor(reason = "unexpected") {
    super("Could not save the change");
    this.name = "CommandFailed";
    this.reason = reason;
  }
}

const isJson = (res) => (res.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
const isRedirect = (res) => res.redirected || (res.status >= 300 && res.status < 400);
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * CommandExecutor port over HTTP: `execute(name, input)` posts to `/api/commands/<name>` and
 * resolves with the server's `{ board, version, … }`. A broken domain rule (422) is thrown as a
 * `DomainError` carrying the server's message and code; anything else as `CommandFailed`.
 * `getBoard()` reads `{ board, version }` from `/api/board`; `getVersion()` reads the version
 * alone from `/api/board/version`, the cheap "has anything changed?" check.
 *
 * In the browser the defaults apply: relative URLs, the cookie the browser already holds.
 * A caller elsewhere (the CLI) gives `baseUrl` and `token`; the token travels as the access
 * cookie and redirects are not followed, so a refusal by the gate is seen as one.
 */
export function createHttpCommandExecutor({ fetch = (...args) => globalThis.fetch(...args), baseUrl = "", token = null } = {}) {
  const remote = token === null ? {} : { redirect: "manual" };
  const withToken = (headers) => (token === null ? headers : { ...headers, Cookie: `k-spec-token=${token}` });

  const reading = () => ({ ...(token === null ? {} : { headers: withToken({}) }), ...remote });

  async function request(path, options, accepted) {
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, options);
    } catch {
      throw new CommandFailed("unreachable");
    }
    // A lost or wrong token redirects to the access page: an answer, but not ours.
    if (isRedirect(res)) throw new CommandFailed("rejected");
    if (!isJson(res) || !accepted.includes(res.status)) {
      throw new CommandFailed(res.status === 404 && isJson(res) && options.method === "POST" ? "unknown-command" : "unexpected");
    }
    let body;
    try {
      body = await res.json();
    } catch {
      throw new CommandFailed("unexpected");
    }
    if (res.status === 422) throw new DomainError(body.error, body.code);
    return body;
  }

  return {
    execute(name, input) {
      return request(
        `/api/commands/${encodeURIComponent(name)}`,
        { method: "POST", headers: withToken({ "Content-Type": "application/json" }), body: JSON.stringify(input ?? {}), ...remote },
        [200, 422],
      );
    },
    async getBoard() {
      const body = await request("/api/board", reading(), [200]);
      if (!isObject(body) || !isObject(body.board)) throw new CommandFailed("unexpected");
      return body;
    },
    async getVersion() {
      const body = await request("/api/board/version", reading(), [200]);
      if (!isObject(body) || !Number.isInteger(body.version)) throw new CommandFailed("unexpected");
      return body.version;
    },
  };
}
