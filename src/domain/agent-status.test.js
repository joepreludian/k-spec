import {
  AGENT_STATUSES,
  DEFAULT_AGENT_STATUS,
  assertAgentStatus,
} from "./agent-status.js";
import { InvalidAgentStatus } from "./errors.js";

test("statuses are the closed set from the spec", () => {
  expect(AGENT_STATUSES).toEqual([
    "idle",
    "working",
    "waiting-for-input",
    "blocked",
  ]);
  expect(Object.isFrozen(AGENT_STATUSES)).toBe(true);
});

test.each(AGENT_STATUSES)("accepts %s", (s) => {
  expect(assertAgentStatus(s)).toBe(s);
});

test("rejects unknown status", () => {
  expect(() => assertAgentStatus("done")).toThrow(InvalidAgentStatus);
});

test("default is idle", () => {
  expect(DEFAULT_AGENT_STATUS).toBe("idle");
});
