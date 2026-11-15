// @vitest-environment node
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy.js";

beforeEach(() => {
  process.env.K_SPEC_TOKEN = "secret";
});

const req = (url, cookie) => {
  const r = new NextRequest(url);
  if (cookie) r.cookies.set("k-spec-token", cookie);
  return r;
};

test("sets cookie and strips token from url", async () => {
  const res = await proxy(req("http://localhost:3000/?token=secret&x=1"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost:3000/?x=1");
  const cookie = res.cookies.get("k-spec-token");
  expect(cookie).toMatchObject({ value: "secret", httpOnly: true, sameSite: "lax", path: "/" });
  expect(cookie.maxAge).toBe(60 * 60 * 24 * 30);
});

test("wrong token redirects to /access?error=1 without cookie", async () => {
  const res = await proxy(req("http://localhost:3000/?token=nope"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost:3000/access?error=1");
  expect(res.cookies.get("k-spec-token")).toBeUndefined();
});

test("no token redirects to /access", async () => {
  const res = await proxy(req("http://localhost:3000/"));
  expect(res.headers.get("location")).toBe("http://localhost:3000/access");
});

test("valid cookie passes through", async () => {
  const res = await proxy(req("http://localhost:3000/", "secret"));
  expect(res.headers.get("location")).toBeNull();
  expect(res.status).toBe(200);
});

test("/access is exempt", async () => {
  const res = await proxy(req("http://localhost:3000/access"));
  expect(res.headers.get("location")).toBeNull();
});

test("matcher excludes static assets", () => {
  expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
});
