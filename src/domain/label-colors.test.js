import { LABEL_COLORS, assertLabelColor } from "./label-colors.js";
import { InvalidLabelColor } from "./errors.js";

test("palette is the fixed list", () => {
  expect(LABEL_COLORS).toEqual([
    "gray",
    "red",
    "orange",
    "amber",
    "green",
    "teal",
    "blue",
    "violet",
    "pink",
  ]);
  expect(Object.isFrozen(LABEL_COLORS)).toBe(true);
});

test.each(LABEL_COLORS)("accepts %s", (c) => {
  expect(assertLabelColor(c)).toBe(c);
});

test("rejects unknown color", () => {
  expect(() => assertLabelColor("magenta")).toThrow(InvalidLabelColor);
});
