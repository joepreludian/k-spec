// @vitest-environment node
import { boardOf } from "@/test/board-server.js";
import { cli, commentOn, fixtureBoard } from "./test-cli.js";
import { WATCH_INTERVAL_MS } from "./watch.js";

const CLAUDE = { kind: "agent", name: "Claude" };
const at = (time) => `2026-11-10T${time}:00.000Z`;
const HEADER = (n) => `watching Test board at http://k.test, ${n} open request${n === 1 ? "" : "s"}`;
const NO_ENV = { K_SPEC_URL: "", K_SPEC_TOKEN: "" };

/** Another client (the browser) running a command on the fake server. */
const post = (name, input) =>
  globalThis.fetch(`http://k.test/api/commands/${name}`, {
    method: "POST",
    headers: { Cookie: "k-spec-token=tok" },
    body: JSON.stringify(input),
  });
const reads = (server, path) => server.requests.filter((r) => r.method === "GET" && r.path === path).length;

/** The fixture with, on #7, an answered request, an open one and a note; on #4 a later open one. */
function busyBoard() {
  let board = fixtureBoard();
  board = commentOn(board, 7, { id: "old", body: "Old question", request: true, at: at("10:10") });
  board = commentOn(board, 7, { id: "reply", body: "Answered", author: CLAUDE, at: at("10:20") });
  board = commentOn(board, 7, { id: "r7", body: "Plan this", request: true, at: at("10:30") });
  board = commentOn(board, 7, { id: "note", body: "For myself", at: at("10:40") });
  return commentOn(board, 4, { id: "r4", body: "Add tests\nplease", request: true, at: at("11:00") });
}

test("watch says what it watches and prints every open request, oldest first", async () => {
  const { code, out, err, world } = await cli(["watch"], { board: busyBoard() });
  expect([code, err]).toEqual([0, ""]);
  expect(out.split("\n")).toEqual([
    HEADER(2),
    "request #7 Seven [Backlog, blocked] You, 2026-11-10 10:30: Plan this",
    "request #4 Four [In progress, idle] You, 2026-11-10 11:00: Add tests please",
  ]);
  expect(world.sleeps).toEqual([WATCH_INTERVAL_MS]);
  expect(WATCH_INTERVAL_MS).toBe(2000);
});

test("with nothing open it still says what it watches", async () => {
  expect((await cli(["watch"], { board: fixtureBoard() })).out).toBe(HEADER(0));
  const one = commentOn(fixtureBoard(), 7, { id: "r", body: "x", request: true });
  expect((await cli(["watch"], { board: one })).out.split("\n")[0]).toBe(HEADER(1));
});

test("a request made while watching is printed once; other edits print nothing", async () => {
  const { out, code } = await cli(["watch"], {
    board: fixtureBoard(),
    steps: [
      () => post("addComment", { cardId: "card-7", body: "Plan this", request: true }),
      () => post("addComment", { cardId: "card-7", body: "a note" }),
      () => post("moveCard", { cardId: "card-7", toLaneId: "lane-done" }),
      () => {},
    ],
  });
  expect(code).toBe(0);
  expect(out.split("\n")).toEqual([HEADER(0), "request #7 Seven [Backlog, blocked] You, 2026-11-10 10:00: Plan this"]);
});

test("the board is read only when the version changed", async () => {
  const idle = () => {};
  const { server, world } = await cli(["watch"], { board: busyBoard(), steps: [idle, idle, idle] });
  expect([reads(server, "/api/board/version"), reads(server, "/api/board")]).toEqual([4, 1]);
  expect(world.sleeps).toEqual([2000, 2000, 2000, 2000]);
});

test("an answered request is not printed again, a new one on the same card is", async () => {
  const { out } = await cli(["watch"], {
    board: commentOn(fixtureBoard(), 7, { id: "r1", body: "First", request: true }),
    steps: [
      () => post("addComment", { cardId: "card-7", body: "Done", author: CLAUDE }),
      () => post("addComment", { cardId: "card-7", body: "Second", request: true }),
    ],
  });
  expect(out.split("\n").map((line) => line.split(": ").at(-1))).toEqual([HEADER(1), "First", "Second"]);
});

test("one request is always exactly one line", async () => {
  let board = boardOf({ "La\tne": ["3:Ti\ntle"] });
  board = commentOn(board, 3, {
    id: "r",
    body: "a\nrequest #1 forged\u2028x\u0007y\r\n  z  ",
    request: true,
    author: { kind: "person", name: "Yo\nu" },
  });
  const { out } = await cli(["watch"], { board });
  expect(out.split("\n")).toEqual([HEADER(1), "request #3 Ti tle [La ne, idle] Yo u, 2026-11-10 10:00: a request #1 forged x y z"]);
  expect(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/.test(out)).toBe(false);
});

test("a long request is cut to 200 characters, never through the middle of one", async () => {
  const long = commentOn(fixtureBoard(), 7, { id: "r", body: "a".repeat(300), request: true });
  expect((await cli(["watch"], { board: long })).out.split(": ").at(-1)).toBe(`${"a".repeat(200)}…`);
  const exact = commentOn(fixtureBoard(), 7, { id: "r", body: "b".repeat(200), request: true });
  expect((await cli(["watch"], { board: exact })).out.split(": ").at(-1)).toBe("b".repeat(200));
  const emoji = commentOn(fixtureBoard(), 7, { id: "r", body: `${"a".repeat(199)}😀${"b".repeat(50)}`, request: true });
  expect((await cli(["watch"], { board: emoji })).out.split(": ").at(-1)).toBe(`${"a".repeat(199)}😀…`);
});

test("an outage is reported once on stdout, and the watch goes on", async () => {
  const later = commentOn(fixtureBoard(), 7, { id: "r", body: "While you were away", request: true });
  const { code, out, err } = await cli(["watch"], {
    board: fixtureBoard(),
    steps: [
      (server) => (server.offline = true),
      () => {}, // still away: nothing more is said
      (server) => {
        server.offline = false;
        server.serve(later, 1); // a new database can come back with a version already seen
      },
      () => {},
    ],
  });
  expect([code, err]).toEqual([0, ""]);
  expect(out.split("\n")).toEqual([
    HEADER(0),
    "k-spec: server not answering at http://k.test",
    "k-spec: connected to http://k.test",
    "request #7 Seven [Backlog, blocked] You, 2026-11-10 10:00: While you were away",
  ]);
});

test("a request already printed is not printed again after an outage", async () => {
  const { out } = await cli(["watch"], {
    board: commentOn(fixtureBoard(), 7, { id: "r", body: "Once", request: true }),
    steps: [(server) => (server.offline = true), (server) => (server.offline = false)],
  });
  expect(out.split("\n").filter((line) => line.startsWith("request "))).toHaveLength(1);
  expect(out.split("\n").at(-1)).toBe("k-spec: connected to http://k.test");
});

test("started before the server, it waits for the note", async () => {
  const { code, out, err } = await cli(["watch"], {
    board: fixtureBoard(),
    env: NO_ENV,
    steps: [() => {}, (server, world) => (world.note = { url: "http://k.test", token: "tok", pid: 1 })],
  });
  expect([code, err]).toEqual([0, ""]);
  expect(out.split("\n")).toEqual([
    "k-spec: server not running (no /work/data/k-spec.server.json; start it with npm run dev, or set K_SPEC_URL and K_SPEC_TOKEN)",
    HEADER(0),
  ]);
});

test("a wrong token in the note is tried again when the note changes", async () => {
  const { out } = await cli(["watch"], {
    board: fixtureBoard(),
    env: NO_ENV,
    note: { url: "http://k.test", token: "old", pid: 1 },
    steps: [(server, world) => (world.note = { url: "http://k.test", token: "tok", pid: 2 })],
  });
  expect(out.split("\n")).toEqual(["k-spec: token rejected by http://k.test", HEADER(0)]);
});

test("settings that cannot heal end the watch", async () => {
  const { code, out, err, world } = await cli(["watch"], { env: { K_SPEC_URL: "http://k.test", K_SPEC_TOKEN: "" } });
  expect([code, out, err]).toEqual([3, "", "error: K_SPEC_URL is set but K_SPEC_TOKEN is not"]);
  expect(world.sleeps).toEqual([]);
});

test("told to stop while a request is under way, it says nothing more", async () => {
  const { code, out, err } = await cli(["watch"], {
    board: fixtureBoard(),
    steps: [
      (server, world) => {
        globalThis.fetch = async () => {
          world.stop();
          throw new TypeError("aborted");
        };
      },
    ],
  });
  expect([code, out, err]).toEqual([0, HEADER(0), ""]);
});

test("--json prints one object per line", async () => {
  const { out } = await cli(["watch", "--json"], {
    board: commentOn(fixtureBoard(), 4, { id: "r4", body: "Add tests\nplease", request: true, at: at("11:00") }),
    steps: [(server) => (server.offline = true), (server) => (server.offline = false)],
  });
  expect(out.split("\n").map((line) => JSON.parse(line))).toEqual([
    { type: "watching", board: "Test board", url: "http://k.test", open: 1 },
    {
      type: "request",
      number: 4,
      title: "Four",
      lane: "In progress",
      status: "idle",
      author: "You",
      createdAt: at("11:00"),
      body: "Add tests\nplease",
      cardId: "card-4",
      commentId: "r4",
    },
    { type: "disconnected", reason: "server not answering at http://k.test" },
    { type: "connected", url: "http://k.test" },
  ]);
});

test("watch takes no arguments", async () => {
  const { code, err, server } = await cli(["watch", "now"]);
  expect([code, err]).toEqual([2, "error: usage: k-spec watch"]);
  expect(server.requests).toEqual([]);
});
