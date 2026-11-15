// @vitest-environment node
import { decideAccess, EXEMPT_PREFIXES, isExemptPath } from "./decide-access.js";

const expected = "secret";

test.each(["/access", "/_next/static/x.js", "/_next/image?url=a", "/favicon.ico"])("exempt %s passes", (p) => {
  expect(isExemptPath(p)).toBe(true);
  expect(decideAccess({ pathname: p, expected })).toEqual({ action: "pass" });
});

test("exempt prefixes are exported", () => {
  expect(EXEMPT_PREFIXES).toContain("/access");
});

test("non-exempt paths are checked", () => {
  expect(isExemptPath("/")).toBe(false);
  expect(isExemptPath("/accessories")).toBe(false);
});

test("valid query token sets cookie", () => {
  expect(decideAccess({ pathname: "/", queryToken: "secret", expected })).toEqual({
    action: "set-cookie-and-redirect",
    token: "secret",
  });
});

test("valid cookie passes", () => {
  expect(decideAccess({ pathname: "/", cookieToken: "secret", expected })).toEqual({ action: "pass" });
});

test("wrong query with valid cookie still passes", () => {
  expect(decideAccess({ pathname: "/", queryToken: "bad", cookieToken: "secret", expected })).toEqual({
    action: "pass",
  });
});

test("wrong query without cookie redirects to access with error", () => {
  expect(decideAccess({ pathname: "/", queryToken: "bad", expected })).toEqual({
    action: "redirect-access",
    error: true,
  });
});

test("nothing redirects to access without error", () => {
  expect(decideAccess({ pathname: "/", expected })).toEqual({ action: "redirect-access", error: false });
  expect(decideAccess({ pathname: "/", cookieToken: "stale", expected })).toEqual({
    action: "redirect-access",
    error: false,
  });
});

test("no expected token configured never passes a non-exempt path", () => {
  expect(decideAccess({ pathname: "/", queryToken: "", cookieToken: "", expected: "" })).toEqual({
    action: "redirect-access",
    error: false,
  });
});
