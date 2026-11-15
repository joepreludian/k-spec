import { createCard } from "./create-card.js";
import { updateCardTitle } from "./update-card-title.js";
import { updateCardDescription } from "./update-card-description.js";
import { moveCard } from "./move-card.js";
import { deleteCard } from "./delete-card.js";
import { setAgentStatus } from "./set-agent-status.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard as newCard } from "@/domain/card.js";
import { fixedClock } from "@/infrastructure/clock.js";
import { EmptyTitle, InvalidAgentStatus, LaneNotFound, CardNotFound } from "@/domain/errors.js";

const T_OLD = "2026-11-01T00:00:00.000Z";
const initial = addCardToLane(
  addLane(addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }), { id: "b", name: "B" }),
  "a",
  newCard({ id: "c1", title: "Existing", now: T_OLD }),
);
let deps;
beforeEach(() => {
  deps = makeDeps(initial);
});

test("createCard appends to the lane with clock timestamps and returns id", async () => {
  const { board, id } = await createCard(deps, { laneId: "b", title: " New " });
  expect(id).toBe("id-1");
  const { lane, card } = findCard(board, "id-1");
  expect(lane.id).toBe("b");
  expect(card).toMatchObject({ title: "New", createdAt: T0, updatedAt: T0, agentStatus: "idle" });
  expect(findCard(await deps.repository.load(), "id-1")).not.toBeNull();
});

test("createCard errors: unknown lane, blank title", async () => {
  await expect(createCard(deps, { laneId: "zz", title: "x" })).rejects.toThrow(LaneNotFound);
  await expect(createCard(deps, { laneId: "a", title: " " })).rejects.toThrow(EmptyTitle);
});

test("updateCardTitle bumps updatedAt and persists", async () => {
  const { board } = await updateCardTitle(deps, { cardId: "c1", title: "Renamed" });
  expect(findCard(board, "c1").card).toMatchObject({ title: "Renamed", updatedAt: T0, createdAt: T_OLD });
  expect(findCard(await deps.repository.load(), "c1").card.title).toBe("Renamed");
});

test("updateCardDescription persists markdown", async () => {
  const { board } = await updateCardDescription(deps, { cardId: "c1", description: "# Goal" });
  expect(findCard(board, "c1").card.description).toBe("# Goal");
  expect(findCard(board, "c1").card.updatedAt).toBe(T0);
});

test("moveCard persists order", async () => {
  const { board } = await moveCard(deps, { cardId: "c1", toLaneId: "b", position: 0 });
  expect(board.lanes.map((l) => l.cards.map((c) => c.id))).toEqual([[], ["c1"]]);
  expect((await deps.repository.load()).lanes[1].cards[0].id).toBe("c1");
});

test("deleteCard removes and persists", async () => {
  const { board } = await deleteCard(deps, { cardId: "c1" });
  expect(findCard(board, "c1")).toBeNull();
  expect(findCard(await deps.repository.load(), "c1")).toBeNull();
  await expect(deleteCard(deps, { cardId: "c1" })).rejects.toThrow(CardNotFound);
});

test("setAgentStatus persists and rejects invalid", async () => {
  const { board } = await setAgentStatus(deps, { cardId: "c1", status: "working" });
  expect(findCard(board, "c1").card.agentStatus).toBe("working");
  await expect(setAgentStatus(deps, { cardId: "c1", status: "nope" })).rejects.toThrow(InvalidAgentStatus);
  expect(findCard(await deps.repository.load(), "c1").card.agentStatus).toBe("working");
});

test("use cases use the injected clock", async () => {
  const later = { ...deps, clock: fixedClock("2027-01-01T00:00:00.000Z") };
  const { board } = await updateCardTitle(later, { cardId: "c1", title: "x" });
  expect(findCard(board, "c1").card.updatedAt).toBe("2027-01-01T00:00:00.000Z");
});
