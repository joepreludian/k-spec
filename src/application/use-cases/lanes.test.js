import { getBoard } from "./get-board.js";
import { createLane } from "./create-lane.js";
import { renameLane } from "./rename-lane.js";
import { removeLane } from "./remove-lane.js";
import { reorderLanes } from "./reorder-lanes.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane } from "@/domain/board.js";
import { EmptyTitle, LaneNotEmpty } from "@/domain/errors.js";

const initial = addLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  { id: "b", name: "B" },
);
let deps;
beforeEach(() => {
  deps = makeDeps(initial);
});

test("getBoard returns the stored board", async () => {
  expect(await getBoard(deps)).toEqual({ board: initial });
  expect(deps.clock.now()).toBe(T0);
});

test("createLane appends and returns id", async () => {
  const { board, id } = await createLane(deps, { name: " QA " });
  expect(id).toBe("id-1");
  expect(board.lanes.at(-1)).toEqual({ id: "id-1", name: "QA", cards: [] });
  expect((await deps.repository.load()).lanes).toHaveLength(3);
});

test("renameLane persists", async () => {
  const { board } = await renameLane(deps, { laneId: "a", name: "Alpha" });
  expect(board.lanes[0].name).toBe("Alpha");
  expect((await deps.repository.load()).lanes[0].name).toBe("Alpha");
});

test("removeLane persists and refuses non-empty", async () => {
  const { board } = await removeLane(deps, { laneId: "b" });
  expect(board.lanes.map((l) => l.id)).toEqual(["a"]);
  const busy = makeDeps({
    ...initial,
    lanes: [{ ...initial.lanes[0], cards: [{ id: "c" }] }, initial.lanes[1]],
  });
  await expect(removeLane(busy, { laneId: "a" })).rejects.toThrow(LaneNotEmpty);
});

test("reorderLanes persists", async () => {
  const { board } = await reorderLanes(deps, { laneIds: ["b", "a"] });
  expect(board.lanes.map((l) => l.id)).toEqual(["b", "a"]);
  expect((await deps.repository.load()).lanes.map((l) => l.id)).toEqual(["b", "a"]);
});

test("domain errors propagate and nothing is saved", async () => {
  await expect(renameLane(deps, { laneId: "a", name: " " })).rejects.toThrow(EmptyTitle);
  expect(await deps.repository.load()).toEqual(initial);
});
