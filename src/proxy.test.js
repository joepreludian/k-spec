// @vitest-environment node
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy.js";

beforeEach(() => {
  process.env.K_SPEC_TOKEN = "secret";
});

const req = (url, cookies = {}, headers = {}) => {
  const r = new NextRequest(url, { headers });
  for (const [name, value] of Object.entries(cookies)) r.cookies.set(name, value);
  return r;
};
const passed = (res) => res.status === 200 && res.headers.get("location") === null;

test("sets the cookie named for the port and strips the token from the url", async () => {
  const res = await proxy(req("http://localhost:3000/?token=secret&x=1"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost:3000/?x=1");
  const cookie = res.cookies.get("k-spec-token-3000");
  expect(cookie).toMatchObject({ value: "secret", httpOnly: true, sameSite: "lax", path: "/" });
  expect(cookie.maxAge).toBe(60 * 60 * 24 * 30);
  // The plain name is left alone: another board under this host name may be using it.
  expect(res.cookies.get("k-spec-token")).toBeUndefined();
});

test("wrong token redirects to /access?error=1 without cookie", async () => {
  const res = await proxy(req("http://localhost:3000/?token=nope"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost:3000/access?error=1");
  expect(res.cookies.getAll()).toEqual([]);
});

test("no token redirects to /access", async () => {
  const res = await proxy(req("http://localhost:3000/"));
  expect(res.headers.get("location")).toBe("http://localhost:3000/access");
});

test("the plain cookie passes: it is what the CLI sends and what browsers held before", async () => {
  expect(passed(await proxy(req("http://localhost:3000/", { "k-spec-token": "secret" })))).toBe(true);
});

test("the cookie named for this port passes", async () => {
  expect(passed(await proxy(req("http://localhost:3000/", { "k-spec-token-3000": "secret" })))).toBe(true);
});

test("two boards under one host name: another board's plain cookie does not sign this one out", async () => {
  const res = await proxy(req("http://localhost:3000/", { "k-spec-token": "the-other-boards", "k-spec-token-3000": "secret" }));
  expect(passed(res)).toBe(true);
  const reverse = await proxy(req("http://localhost:3000/", { "k-spec-token": "secret", "k-spec-token-3000": "stale" }));
  expect(passed(reverse)).toBe(true);
});

test("a cookie named for another port is not this board's, whatever it holds", async () => {
  const res = await proxy(req("http://localhost:3000/", { "k-spec-token-3001": "secret" }));
  expect(res.headers.get("location")).toBe("http://localhost:3000/access");
});

test("a wrong token is refused under either name", async () => {
  for (const cookies of [{ "k-spec-token": "nope" }, { "k-spec-token-3000": "nope" }, { "k-spec-token": "nope", "k-spec-token-3000": "nope2" }]) {
    const res = await proxy(req("http://localhost:3000/", cookies));
    expect(res.headers.get("location")).toBe("http://localhost:3000/access");
  }
});

test("the port is the one the browser used: the Host header", async () => {
  const res = await proxy(req("http://localhost:3000/?token=secret", {}, { host: "lima.local:14201" }));
  expect(res.cookies.get("k-spec-token-14201")?.value).toBe("secret");
  expect(res.cookies.get("k-spec-token-3000")).toBeUndefined();
  expect(passed(await proxy(req("http://localhost:3000/", { "k-spec-token-14201": "secret" }, { host: "lima.local:14201" })))).toBe(true);
});

test("a host without a port uses the plain cookie", async () => {
  const res = await proxy(req("http://board.example/?token=secret"));
  expect(res.cookies.get("k-spec-token")?.value).toBe("secret");
});

test("/access is exempt", async () => {
  const res = await proxy(req("http://localhost:3000/access"));
  expect(res.headers.get("location")).toBeNull();
});

test("matcher excludes static assets", () => {
  expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
});

test("/api/files needs the cookie too", async () => {
  const res = await proxy(req("http://localhost:3000/api/files/README.md"));
  expect(res.headers.get("location")).toBe("http://localhost:3000/access");
});
