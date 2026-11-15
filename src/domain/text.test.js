import { requireNonEmpty } from "./text.js";
import { EmptyTitle, EmptyText } from "./errors.js";

test("trims and returns", () => {
  expect(requireNonEmpty("  hi ", EmptyTitle)).toBe("hi");
});

test.each(["", "   ", null, undefined, 3])("rejects %p", (v) => {
  expect(() => requireNonEmpty(v, EmptyTitle)).toThrow(EmptyTitle);
});

test("throws the given error class", () => {
  expect(() => requireNonEmpty(" ", EmptyText)).toThrow(EmptyText);
});
