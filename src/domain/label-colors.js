import { InvalidLabelColor } from "./errors.js";

export const LABEL_COLORS = Object.freeze([
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

export function assertLabelColor(color) {
  if (!LABEL_COLORS.includes(color)) throw new InvalidLabelColor(color);
  return color;
}
