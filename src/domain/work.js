import { EmptyText, InvalidWorkLocation, InvalidWorkSession } from "./errors.js";
import { requireNonEmpty } from "./text.js";

export const WORK_LOCATION_KINDS = Object.freeze(["lima", "worktree", "host"]);

const isCount = (n) => Number.isInteger(n) && n >= 0;
const isObject = (v) => typeof v === "object" && v !== null;

function assertLocation(location) {
  if (!isObject(location) || !WORK_LOCATION_KINDS.includes(location.kind)) {
    throw new InvalidWorkLocation(location?.kind);
  }
  return { kind: location.kind, name: requireNonEmpty(location.name, EmptyText) };
}

/**
 * Validates a Claude session block and returns it normalised: a missing `lastTool` becomes
 * `null`; `lastActivityAt` stays optional here (callers default it to now).
 */
export function assertWorkSession(session) {
  const lastTool = session?.lastTool ?? null;
  const ok =
    isObject(session) &&
    typeof session.id === "string" &&
    session.id.trim() &&
    typeof session.model === "string" &&
    session.model.trim() &&
    isObject(session.tokens) &&
    ["input", "output", "cached"].every((k) => isCount(session.tokens[k])) &&
    isCount(session.turns) &&
    (lastTool === null ||
      (isObject(lastTool) &&
        typeof lastTool.name === "string" &&
        lastTool.name.trim() &&
        typeof lastTool.at === "string")) &&
    (session.lastActivityAt === undefined || typeof session.lastActivityAt === "string");
  if (!ok) throw new InvalidWorkSession();
  return { ...session, lastTool };
}

/** `lastActivityAt` defaults to `now` so "Last activity" always has a value. */
export function withActivityStamp(session, now) {
  return { ...session, lastActivityAt: session.lastActivityAt ?? now };
}

/** A self-contained "where this card is being worked" block (see design: can become its own file later). */
export function createWork({ location, branch, worktreePath = null, session = null, now }) {
  return {
    location: assertLocation(location),
    branch: requireNonEmpty(branch, EmptyText),
    worktreePath: typeof worktreePath === "string" && worktreePath.trim() ? worktreePath : null,
    startedAt: now,
    session: session === null ? null : withActivityStamp(assertWorkSession(session), now),
  };
}
