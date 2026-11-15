import { formatTokens, shortId, sessionTotalTokens } from "./format.js";

test.each([
  [0, "0"],
  [999, "999"],
  [1000, "1k"],
  [184000, "184k"],
  [999999, "999k"],
  [1200000, "1.2M"],
  [2000000, "2.0M"],
])("formatTokens(%i) → %s", (n, s) => {
  expect(formatTokens(n)).toBe(s);
});

test("shortId keeps the first 8 characters", () => {
  expect(shortId("8c4acf00-42c1-4317-b31b")).toBe("8c4acf00…");
  expect(shortId("short")).toBe("short");
});

test("sessionTotalTokens is input + output, never cached", () => {
  expect(sessionTotalTokens({ tokens: { input: 184000, output: 22000, cached: 61000 } })).toBe(206000);
  expect(sessionTotalTokens(null)).toBe(0);
});
