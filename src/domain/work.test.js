import { WORK_LOCATION_KINDS, createWork, assertWorkSession } from "./work.js";
import { EmptyText, InvalidWorkLocation, InvalidWorkSession } from "./errors.js";

const T0 = "2026-11-14T10:00:00.000Z";
const loc = { kind: "lima", name: "lima-dev-k-spec-watcher" };

test("location kinds", () => {
  expect(WORK_LOCATION_KINDS).toEqual(["lima", "worktree", "host"]);
});

test("createWork fills defaults", () => {
  expect(createWork({ location: loc, branch: "feat/watcher", now: T0 })).toEqual({
    location: loc,
    branch: "feat/watcher",
    worktreePath: null,
    startedAt: T0,
    session: null,
  });
});

test("createWork keeps worktreePath and a valid session", () => {
  const session = { id: "s", model: "m", tokens: { input: 1, output: 1, cached: 0 }, turns: 1, lastTool: null, lastActivityAt: T0 };
  expect(createWork({ location: loc, branch: "b", worktreePath: "~/w", session, now: T0 })).toMatchObject({
    worktreePath: "~/w",
    session,
  });
});

test("createWork validates kind, name and branch", () => {
  expect(() => createWork({ location: { kind: "cloud", name: "x" }, branch: "b", now: T0 })).toThrow(InvalidWorkLocation);
  expect(() => createWork({ location: null, branch: "b", now: T0 })).toThrow(InvalidWorkLocation);
  expect(() => createWork({ location: { kind: "lima", name: " " }, branch: "b", now: T0 })).toThrow(EmptyText);
  expect(() => createWork({ location: loc, branch: "", now: T0 })).toThrow(EmptyText);
});

const session = {
  id: "s1",
  model: "claude-fable-5-1",
  tokens: { input: 10, output: 2, cached: 3 },
  turns: 1,
  lastTool: null,
  lastActivityAt: T0,
};

test("assertWorkSession accepts a full session and rejects bad shapes", () => {
  expect(assertWorkSession(session)).toEqual(session);
  expect(assertWorkSession({ ...session, lastTool: { name: "Bash", at: T0 } }).lastTool).toEqual({ name: "Bash", at: T0 });
  for (const bad of [
    { ...session, id: "" },
    { ...session, model: " " },
    { ...session, tokens: { input: -1, output: 0, cached: 0 } },
    { ...session, tokens: { input: 1, output: 0 } },
    { ...session, turns: 1.5 },
    { ...session, lastTool: { name: "Bash" } },
    null,
    "nope",
  ])
    expect(() => assertWorkSession(bad)).toThrow(InvalidWorkSession);
});
