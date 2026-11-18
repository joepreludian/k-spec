import { DomainError } from "@/domain/errors.js";

/** The server did not run the command: unreachable, an error, or the access gate answered instead. */
export class CommandFailed extends Error {
  constructor() {
    super("Could not save the change");
    this.name = "CommandFailed";
  }
}

const isJson = (res) => (res.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");

/**
 * CommandExecutor port over HTTP: `execute(name, input)` posts to `/api/commands/<name>` and
 * resolves with the server's `{ board, version, … }`. A broken domain rule (422) is thrown as a
 * `DomainError` carrying the server's message and code; anything else as `CommandFailed`.
 */
export function createHttpCommandExecutor({ fetch = (...args) => globalThis.fetch(...args) } = {}) {
  return {
    async execute(name, input) {
      let res;
      try {
        res = await fetch(`/api/commands/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input ?? {}),
        });
      } catch {
        throw new CommandFailed();
      }
      // A lost token cookie redirects to the access page: a 200 that is not our answer.
      if (res.redirected || !isJson(res) || (res.status !== 200 && res.status !== 422)) throw new CommandFailed();
      const body = await res.json();
      if (res.status === 422) throw new DomainError(body.error, body.code);
      return body;
    },
  };
}
