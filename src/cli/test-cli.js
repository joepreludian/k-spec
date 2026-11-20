import { boardOf, installBoardServer } from "@/test/board-server.js";
import { runCli } from "./main.js";

export { commentOn, fixtureBoard } from "@/test/cli-fixture.js";

/**
 * Runs the CLI against the fake board server at http://k.test (token `tok`) and returns
 * `{ code, out, err, server }`, `out` and `err` being the printed lines joined by newlines.
 * `env` is merged over the connection settings; `note` is the content of the server note in
 * the working directory (`/work`); `stdin` is what `-` reads; `gitBranch: null` means "not in
 * a git repository"; `server` sets `offline` or `afterRead` on the fake server.
 *
 * For a command that waits (`watch`): every time it sleeps, the next of `steps` runs as
 * `step(server, world)`, and when none is left it is told to stop. `world` is also returned:
 * `world.note` is the server note (a step may change it), `world.sleeps` the waits asked for,
 * `world.stop()` tells the command to stop at once.
 */
export async function cli(
  args,
  { board = boardOf(), env = {}, stdin = "", note = null, gitBranch = "feat/x", server: setup = {}, steps = [] } = {},
) {
  const server = installBoardServer(board, 1, { baseUrl: "http://k.test", token: "tok" });
  Object.assign(server, setup);
  const out = [];
  const err = [];
  const stopping = new AbortController();
  const world = { note, sleeps: [], stop: () => stopping.abort() };
  const pending = [...steps];
  const code = await runCli({
    argv: args,
    env: { K_SPEC_URL: "http://k.test", K_SPEC_TOKEN: "tok", ...env },
    cwd: "/work",
    fetch: (...request) => globalThis.fetch(...request),
    readFile: (file) => (world.note !== null && file === "/work/data/k-spec.server.json" ? JSON.stringify(world.note) : null),
    readStdin: async () => stdin,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    hostname: () => "box",
    gitBranch: () => gitBranch,
    sleep: async (ms) => {
      world.sleeps.push(ms);
      const step = pending.shift();
      if (step) await step(server, world);
      else world.stop();
    },
    signal: stopping.signal,
  });
  return { code, out: out.join("\n"), err: err.join("\n"), server, world };
}
