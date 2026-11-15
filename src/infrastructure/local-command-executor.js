import { COMMANDS } from "@/application/commands.js";

/**
 * CommandExecutor port: `{ execute(name, input) → Promise<result> }`.
 * Runs use cases in-process against the injected deps.
 */
export function createLocalCommandExecutor(deps) {
  return {
    async execute(name, input = {}) {
      const command = COMMANDS[name];
      if (!command) throw new Error(`Unknown command: ${name}`);
      return command(deps, input);
    },
  };
}
