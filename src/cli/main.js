import path from "node:path";
import { parseArgs } from "node:util";
import { DomainError } from "@/domain/errors.js";
import { createHttpCommandExecutor } from "@/infrastructure/http-command-executor.js";
import { connectionTrouble, resolveConnection } from "./connection.js";
import { UsageError } from "./errors.js";
import { READ_COMMANDS } from "./read-commands.js";
import { oneLine } from "./render.js";
import { usageText } from "./usage.js";
import { WATCH_COMMANDS } from "./watch.js";
import { WRITE_COMMANDS } from "./write-commands.js";

/** Every command the CLI has, by name. */
export const COMMAND_HANDLERS = Object.freeze({ ...READ_COMMANDS, ...WATCH_COMMANDS, ...WRITE_COMMANDS });

export const USAGE = usageText(COMMAND_HANDLERS);

const HELP = new Set(["help", "--help", "-h"]);

function parse(command, words) {
  let parsed;
  try {
    parsed = parseArgs({
      args: words,
      options: { ...command.options, json: { type: "boolean" } },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(error.message.split("\n")[0]);
  }
  const [min, max] = command.arity;
  if (parsed.positionals.length < min || parsed.positionals.length > max) {
    throw new UsageError(`usage: k-spec ${command.usage}`);
  }
  return parsed;
}

/**
 * The `k-spec` command with its world passed in: `argv` (the words after `k-spec`), `env`,
 * `cwd`, `fetch`, `readFile(path)` (text, or null when missing), `readStdin()`, `stdout(line)`,
 * `stderr(line)`, `hostname()`, `gitBranch()` (name, or null), and for a command that waits:
 * `sleep(ms)` and `signal` (an AbortSignal: aborted means "stop now"). Resolves to the exit code:
 * 0 done, 1 refused, 2 usage, 3 no connection. A failure is one `error: …` line on stderr.
 *
 * `K_SPEC_HOSTNAME` and `K_SPEC_BRANCH` in `env` answer for `hostname()` and `gitBranch()`: a
 * project's launcher runs the CLI in a container, where asking would describe the container.
 *
 * A command gets `ctx.api`, already pointed at the server. One marked `lazy` gets none: it calls
 * `ctx.connect()` itself, as often as it needs, and so can outlive a restart of the server.
 */
export async function runCli({ argv, env, cwd, fetch, readFile, readStdin, stdout, stderr, hostname, gitBranch, sleep, signal }) {
  const [name, ...words] = argv;
  if (name === undefined || HELP.has(name)) {
    stdout(USAGE);
    return 0;
  }
  let url;
  const noteFile = env.K_SPEC_SERVER_FILE || path.join(cwd, "data", "k-spec.server.json");
  /** Where the server is right now, and the API on it: `{ url, api }`. */
  const connect = () => {
    const connection = resolveConnection({ env, noteFile, readFile });
    url = connection.url;
    return { url, api: createHttpCommandExecutor({ fetch, baseUrl: url, token: connection.token }) };
  };
  try {
    if (!Object.hasOwn(COMMAND_HANDLERS, name)) throw new UsageError(`unknown command: ${name} (try k-spec help)`);
    const command = COMMAND_HANDLERS[name];
    const args = parse(command, words);
    const ctx = {
      env,
      out: stdout,
      readStdin,
      hostname: () => env.K_SPEC_HOSTNAME?.trim() || hostname(),
      gitBranch: () => env.K_SPEC_BRANCH?.trim() || gitBranch(),
      json: args.values.json === true,
      connect,
      sleep,
      signal,
    };
    if (!command.lazy) ctx.api = connect().api;
    await command.run(ctx, args);
    return 0;
  } catch (error) {
    const fail = (code, message) => {
      stderr(`error: ${oneLine(message)}`); // names from the board can be in it
      return code;
    };
    if (error instanceof UsageError) return fail(2, error.message);
    if (error instanceof DomainError) return fail(1, error.message);
    const trouble = connectionTrouble(error, url);
    if (trouble !== null) return fail(3, trouble);
    throw error;
  }
}
