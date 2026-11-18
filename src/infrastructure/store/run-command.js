import { COMMANDS } from "@/application/commands.js";
import { DomainError } from "@/domain/errors.js";

const answer = (status, body) => ({ status, body });
const isJson = (contentType) => typeof contentType === "string" && contentType.trim().toLowerCase().startsWith("application/json");
// Reading is `GET /api/board`; everything else in the registry changes the board.
const isCommand = (name) => Object.hasOwn(COMMANDS, name) && name !== "getBoard";

function parseInput(text) {
  try {
    const input = JSON.parse(text);
    return typeof input === "object" && input !== null && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

/**
 * One command request, HTTP-shaped: `{ status, body }`.
 * 200 `{ ...result, version }` · 422 `{ error, code }` for a broken domain rule · 404 unknown
 * command · 400 body is not a JSON object · 415 not sent as JSON · 500 anything else.
 * `deps` is `{ repository, clock, idGenerator }`; `queue` makes commands run one at a time.
 */
export async function runCommand({ deps, queue, name, contentType, text }) {
  if (!isJson(contentType)) return answer(415, { error: "Content-Type must be application/json" });
  if (!isCommand(name)) return answer(404, { error: `Unknown command: ${name}` });
  const input = parseInput(text);
  if (!input) return answer(400, { error: "Body must be a JSON object" });
  try {
    return await queue.run(async () => {
      const result = await COMMANDS[name](deps, input);
      return answer(200, { ...result, version: deps.repository.version() });
    });
  } catch (error) {
    if (error instanceof DomainError) return answer(422, { error: error.message, code: error.code });
    console.error(`Command ${name} failed`, error);
    return answer(500, { error: "Command failed" });
  }
}
