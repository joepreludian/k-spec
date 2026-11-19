// @vitest-environment node
import { boardOf, installBoardServer } from "./board-server.js";

test("with a base URL and token it answers only that origin and that cookie", async () => {
  installBoardServer(boardOf(), 1, { baseUrl: "http://k.test", token: "tok" });
  const ok = await fetch("http://k.test/api/board", { headers: { Cookie: "k-spec-token=tok" } });
  expect(ok.status).toBe(200);
  expect((await fetch("http://k.test/api/board", { headers: { Cookie: "k-spec-token=no" } })).status).toBe(307);
  expect((await fetch("http://k.test/api/board")).status).toBe(307);
  expect((await fetch("/api/board", { headers: { Cookie: "k-spec-token=tok" } })).status).toBe(404);
});

test("it refuses what the real commands endpoint refuses", async () => {
  installBoardServer(boardOf());
  const post = (name, body) => fetch(`/api/commands/${name}`, { method: "POST", body });
  expect((await post("getBoard", "{}")).status).toBe(404);
  const unknown = await post("nope", "{}");
  expect([unknown.status, await unknown.json()]).toEqual([404, { error: "Unknown command: nope" }]);
  expect((await post("constructor", "{}")).status).toBe(404);
  expect((await post("createLane", "[]")).status).toBe(400);
  expect((await post("createLane", "{oops")).status).toBe(400);
});

test("it records every request", async () => {
  const server = installBoardServer(boardOf());
  await fetch("/api/board");
  await fetch("/api/commands/createLane", { method: "POST", body: '{"name":"X"}' });
  expect(server.requests).toEqual([
    { method: "GET", path: "/api/board", input: undefined },
    { method: "POST", path: "/api/commands/createLane", input: { name: "X" } },
  ]);
});
