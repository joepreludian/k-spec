import { relativeTime } from "./relative-time.js";

const now = new Date("2026-11-14T12:00:00.000Z");
const ago = (ms) => new Date(now.getTime() - ms).toISOString();

test.each([
  [ago(0), "just now"],
  [ago(59_000), "just now"],
  [ago(60_000), "1m ago"],
  [ago(5 * 60_000), "5m ago"],
  [ago(59 * 60_000), "59m ago"],
  [ago(60 * 60_000), "1h ago"],
  [ago(3 * 3600_000), "3h ago"],
  [ago(23 * 3600_000), "23h ago"],
  [ago(24 * 3600_000), "1d ago"],
  [ago(2 * 86400_000), "2d ago"],
  [ago(6 * 86400_000), "6d ago"],
])("%s → %s", (iso, expected) => {
  expect(relativeTime(iso, now)).toBe(expected);
});

test("a week or more falls back to the locale date", () => {
  const iso = ago(7 * 86400_000);
  expect(relativeTime(iso, now)).toBe(new Date(iso).toLocaleDateString());
});

test("future timestamps read as just now", () => {
  expect(relativeTime(new Date(now.getTime() + 60_000).toISOString(), now)).toBe("just now");
});
