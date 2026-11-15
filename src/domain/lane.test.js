import { createLane, renameLane } from "./lane.js";
import { EmptyTitle } from "./errors.js";

test("createLane trims name and starts empty", () => {
  expect(createLane({ id: "a", name: " Todo " })).toEqual({ id: "a", name: "Todo", cards: [] });
});

test("blank names rejected on create and rename", () => {
  expect(() => createLane({ id: "a", name: " " })).toThrow(EmptyTitle);
  expect(() => renameLane(createLane({ id: "a", name: "A" }), "")).toThrow(EmptyTitle);
});

test("renameLane returns a new lane", () => {
  const l = createLane({ id: "a", name: "A" });
  const r = renameLane(l, "B");
  expect(r).not.toBe(l);
  expect(r.name).toBe("B");
  expect(l.name).toBe("A");
});
