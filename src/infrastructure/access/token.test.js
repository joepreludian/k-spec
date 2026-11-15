// @vitest-environment node
import { generateToken, isValidToken, resolveToken } from "./token.js";

test("generateToken is 32 url-safe chars and unique", () => {
  const a = generateToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(generateToken()).not.toBe(a);
});

test("isValidToken compares safely", () => {
  expect(isValidToken("abc", "abc")).toBe(true);
  expect(isValidToken("abd", "abc")).toBe(false);
  expect(isValidToken("ab", "abc")).toBe(false);
  expect(isValidToken(undefined, "abc")).toBe(false);
  expect(isValidToken(null, "abc")).toBe(false);
  expect(isValidToken("", "")).toBe(false);
  expect(isValidToken("abc", undefined)).toBe(false);
});

test("resolveToken uses env or generates and stores", () => {
  expect(resolveToken({ K_SPEC_TOKEN: "x" })).toBe("x");
  const env = {};
  const t = resolveToken(env);
  expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(env.K_SPEC_TOKEN).toBe(t);
  expect(resolveToken(env)).toBe(t);
  expect(resolveToken({ K_SPEC_TOKEN: "   " })).not.toBe("   ");
});
