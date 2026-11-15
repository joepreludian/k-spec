import { InvalidAgentStatus } from "./errors.js";

export const AGENT_STATUSES = Object.freeze([
  "idle",
  "working",
  "waiting-for-input",
  "blocked",
]);

export const DEFAULT_AGENT_STATUS = "idle";

export function assertAgentStatus(value) {
  if (!AGENT_STATUSES.includes(value)) throw new InvalidAgentStatus(value);
  return value;
}
