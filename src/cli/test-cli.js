import { boardOf, installBoardServer } from "@/test/board-server.js";
import { runCli } from "./main.js";

export { fixtureBoard } from "@/test/cli-fixture.js";

/**
 * Runs the CLI against the fake board server at http://k.test (token `tok`) and returns
 * `{ code, out, err, server }`, `out` and `err` being the printed lines joined by newlines.
 * `env` is merged over the connection settings; `note` is the content of the server note in
 * the working directory (`/work`); `stdin` is what `-` reads; `gitBranch: null` means "not in
 * a git repository"; `server` sets `offline` or `afterRead` on the fake server.
 */
export async function cli(args, { board = boardOf(), env = {}, stdin = "", note = null, gitBranch = "feat/x", server: setup = {} } = {}) {
  const server = installBoardServer(board, 1, { baseUrl: "http://k.test", token: "tok" });
  Object.assign(server, setup);
  const out = [];
  const err = [];
  const code = await runCli({
    argv: args,
    env: { K_SPEC_URL: "http://k.test", K_SPEC_TOKEN: "tok", ...env },
    cwd: "/work",
    fetch: globalThis.fetch,
    readFile: (file) => (note !== null && file === "/work/data/k-spec.server.json" ? JSON.stringify(note) : null),
    readStdin: async () => stdin,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    hostname: () => "box",
    gitBranch: () => gitBranch,
  });
  return { code, out: out.join("\n"), err: err.join("\n"), server };
}
