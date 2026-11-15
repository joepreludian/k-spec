import { startWork } from "./start-work.js";
import { updateWorkSession } from "./update-work-session.js";
import { endWork } from "./end-work.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { NoActiveWork } from "@/domain/errors.js";

const initial = addCardToLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  "a",
  createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
);
const host = { kind: "host", name: "mbp" };
let deps;
beforeEach(() => {
  deps = makeDeps(initial);
});

test("startWork sets work on the card at clock time", async () => {
  const { board } = await startWork(deps, { cardId: "c1", location: host, branch: "main" });
  expect(findCard(board, "c1").card.work).toMatchObject({ location: host, branch: "main", startedAt: T0 });
  expect(findCard(await deps.repository.load(), "c1").card.work).not.toBeNull();
});

test("updateWorkSession then endWork", async () => {
  await startWork(deps, { cardId: "c1", location: host, branch: "main" });
  const s = { id: "s1", model: "m", tokens: { input: 1, output: 1, cached: 0 }, turns: 1, lastTool: null };
  let { board } = await updateWorkSession(deps, { cardId: "c1", session: s });
  expect(findCard(board, "c1").card.work.session).toEqual({ ...s, lastActivityAt: T0 });
  ({ board } = await endWork(deps, { cardId: "c1" }));
  expect(findCard(board, "c1").card.work).toBeNull();
  expect(findCard(board, "c1").card.workHistory).toHaveLength(1);
});

test("updateWorkSession without work rejects with NoActiveWork", async () => {
  await expect(updateWorkSession(deps, { cardId: "c1", session: {} })).rejects.toThrow(NoActiveWork);
});
