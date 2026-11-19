import path from "node:path";
import { parseArgs } from "node:util";
import { DomainError } from "@/domain/errors.js";
import { CommandFailed, createHttpCommandExecutor } from "@/infrastructure/http-command-executor.js";
import { ConnectionError, resolveConnection } from "./connection.js";
import { UsageError } from "./errors.js";
import { READ_COMMANDS } from "./read-commands.js";
import { usageText } from "./usage.js";

/** Every command the CLI has, by name. */
export const COMMAND_HANDLERS = Object.freeze({ ...READ_COMMANDS });

export const USAGE = usageText(COMMAND_HANDLERS);

const HELP = new Set(["help", "--help", "-h"]);
const UNANSWERED = {
  unreachable: (url) => `server not answering at ${url}`,
  rejected: (url) => `token rejected by ${url}`,
};

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
    throw new UsageError(error.message);
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
 * `stderr(line)`, `hostname()`, `gitBranch()` (name, or null). Resolves to the exit code:
 * 0 done, 1 refused, 2 usage, 3 no connection. A failure is one `error: …` line on stderr.
 */
export async function runCli({ argv, env, cwd, fetch, readFile, readStdin, stdout, stderr, hostname, gitBranch }) {
  const [name, ...words] = argv;
  if (name === undefined || HELP.has(name)) {
    stdout(USAGE);
    return 0;
  }
  let url;
  try {
    if (!Object.hasOwn(COMMAND_HANDLERS, name)) throw new UsageError(`unknown command: ${name} (try k-spec help)`);
    const command = COMMAND_HANDLERS[name];
    const args = parse(command, words);
    const noteFile = env.K_SPEC_SERVER_FILE || path.join(cwd, "data", "k-spec.server.json");
    const connection = resolveConnection({ env, noteFile, readFile });
    url = connection.url;
    const api = createHttpCommandExecutor({ fetch, baseUrl: url, token: connection.token });
    await command.run({ api, env, out: stdout, readStdin, hostname, gitBranch, json: args.values.json === true }, args);
    return 0;
  } catch (error) {
    const fail = (code, message) => {
      stderr(`error: ${message}`);
      return code;
    };
    if (error instanceof UsageError) return fail(2, error.message);
    if (error instanceof DomainError) return fail(1, error.message);
    if (error instanceof ConnectionError) return fail(3, error.message);
    if (error instanceof CommandFailed) return fail(3, (UNANSWERED[error.reason] ?? ((u) => `unexpected answer from ${u}`))(url));
    throw error;
  }
}
