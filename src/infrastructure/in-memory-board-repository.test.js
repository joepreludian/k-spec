import { createInMemoryBoardRepository } from "./in-memory-board-repository.js";
import { createBoard, addLane } from "@/domain/board.js";

const b = addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" });

test("load returns a copy, save replaces", async () => {
  const r = createInMemoryBoardRepository(b);
  const loaded = await r.load();
  expect(loaded).toEqual(b);
  expect(loaded).not.toBe(b);
  loaded.name = "x";
  expect((await r.load()).name).toBe("Board");
  await r.save(loaded);
  expect((await r.load()).name).toBe("x");
  loaded.name = "y";
  expect((await r.load()).name).toBe("x");
});
