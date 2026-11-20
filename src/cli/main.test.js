// @vitest-environment node
import { renderBoard } from "./render.js";
import { cli, fixtureBoard } from "./test-cli.js";

const NO_ENV = { K_SPEC_URL: "", K_SPEC_TOKEN: "" };

test("no arguments, help and --help print usage", async () => {
  for (const args of [[], ["help"], ["--help"], ["-h"]]) {
    const { code, out, err } = await cli(args);
    expect([code, err]).toEqual([0, ""]);
    expect(out.split("\n")[0]).toBe("k-spec <command> [arguments] [options]");
  }
});

test("help needs no server", async () => {
  const { code, server } = await cli(["help"], { env: NO_ENV });
  expect(code).toBe(0);
  expect(server.requests).toEqual([]);
});

test("usage names the settings an agent needs", async () => {
  const { out } = await cli(["help"]);
  for (const word of ["--json", "K_SPEC_URL", "K_SPEC_TOKEN", "K_SPEC_AGENT", "K_SPEC_SERVER_FILE", "board", "show <n>", "watch", "--request", "Requests to the agent"]) {
    expect(out).toContain(word);
  }
});

test("board prints the board", async () => {
  const { code, out, err } = await cli(["board"], { board: fixtureBoard() });
  expect([code, err]).toEqual([0, ""]);
  expect(out).toBe(renderBoard({ board: fixtureBoard(), version: 1 }));
});

test("board takes filters", async () => {
  const { out } = await cli(["board", "--status", "blocked", "--lane", "backlog"], { board: fixtureBoard() });
  expect(out).toBe("Test board  v1\nBacklog (1)\n  #7 blocked  Seven");
});

test("show prints one card, with or without the #", async () => {
  const a = await cli(["show", "4"], { board: fixtureBoard() });
  const b = await cli(["show", "#4"], { board: fixtureBoard() });
  expect(a.out.split("\n")[0]).toBe("#4 Four");
  expect(a.out).toContain("\nComments (2)\n");
  expect(b.out).toBe(a.out);
  expect((await cli(["show", "7"], { board: fixtureBoard() })).out).not.toContain("Activity");
  expect((await cli(["show", "7", "--activity"], { board: fixtureBoard() })).out).toContain("\nActivity\n");
});

test("--json prints the machine form", async () => {
  const board = JSON.parse((await cli(["board", "--json"], { board: fixtureBoard() })).out);
  expect(board.version).toBe(1);
  expect(board.board.lanes).toHaveLength(3);
  const card = JSON.parse((await cli(["show", "4", "--json"], { board: fixtureBoard() })).out);
  expect([card.number, card.lane, card.id]).toEqual([4, "In progress", "card-4"]);
});

test.each([
  [["show", "99"], 1, "error: Card #99 not found"],
  [["show", "4abc"], 1, "error: Not a card number: 4abc"],
  [["show", "0"], 1, "error: Not a card number: 0"],
  [["board", "--lane", "Nope"], 1, 'error: Lane "Nope" not found (lanes: Backlog, In progress, Done)'],
  [["frobnicate"], 2, "error: unknown command: frobnicate (try k-spec help)"],
  [["constructor"], 2, "error: unknown command: constructor (try k-spec help)"],
  [["show"], 2, "error: usage: k-spec show <n> [--activity]"],
  [["show", "4", "5"], 2, "error: usage: k-spec show <n> [--activity]"],
  [["board", "extra"], 2, "error: usage: k-spec board [--lane <name>] [--status <status>]"],
])("%j exits %i", async (args, code, message) => {
  const run = await cli(args, { board: fixtureBoard() });
  expect([run.code, run.err, run.out]).toEqual([code, message, ""]);
});

test("an unknown option is a usage error", async () => {
  const run = await cli(["board", "--colour"], { board: fixtureBoard() });
  expect(run.code).toBe(2);
  expect(run.err).toMatch(/^error: .*--colour/);
  expect(run.err.split("\n")).toHaveLength(1);
  expect(run.server.requests).toEqual([]);
});

test("a wrong token says so", async () => {
  const run = await cli(["board"], { env: { K_SPEC_TOKEN: "wrong" } });
  expect([run.code, run.err, run.out]).toEqual([3, "error: token rejected by http://k.test", ""]);
});

test("a server that is down says so", async () => {
  const run = await cli(["board"], { server: { offline: true } });
  expect([run.code, run.err]).toEqual([3, "error: server not answering at http://k.test"]);
});

test("something else answering on the URL is not a stack trace", async () => {
  const run = await cli(["board"], { env: { K_SPEC_URL: "http://other.test" } });
  expect([run.code, run.err]).toEqual([3, "error: unexpected answer from http://other.test"]);
});

test("no connection settings and no note says how to start", async () => {
  const run = await cli(["board"], { env: NO_ENV });
  expect([run.code, run.err]).toEqual([
    3,
    "error: server not running (no /work/data/k-spec.server.json; start it with npm run dev, or set K_SPEC_URL and K_SPEC_TOKEN)",
  ]);
});

test("a launcher's start hint replaces npm run dev in that line", async () => {
  const run = await cli(["board"], { env: { ...NO_ENV, K_SPEC_START_HINT: "docker compose -f .k-spec/compose.yaml up -d" } });
  expect([run.code, run.err]).toEqual([
    3,
    "error: server not running (no /work/data/k-spec.server.json; start it with docker compose -f .k-spec/compose.yaml up -d)",
  ]);
});

test("without K_SPEC_URL the note file is used", async () => {
  const run = await cli(["board"], { env: NO_ENV, note: { url: "http://k.test", token: "tok" } });
  expect(run.code).toBe(0);
  const elsewhere = await cli(["board"], { env: { ...NO_ENV, K_SPEC_SERVER_FILE: "/other/note.json" }, note: { url: "http://k.test", token: "tok" } });
  expect(elsewhere.err).toMatch(/^error: server not running \(no \/other\/note\.json;/);
});

test("a mistyped status filter is refused", async () => {
  const run = await cli(["board", "--status", "workng"], { board: fixtureBoard() });
  expect([run.code, run.err, run.out]).toEqual([1, 'error: "workng" is not a valid agent status', ""]);
});

test("a failure is always exactly one line, whatever the text in it", async () => {
  const board = fixtureBoard();
  board.lanes[0].name = "Back\nlog\x1b[2J";
  const lookup = await cli(["board", "--lane", "Nope"], { board });
  expect(lookup.err).toBe('error: Lane "Nope" not found (lanes: Back log [2J, In progress, Done)');
  const usage = await cli(["add", "backlog", "T", "--description", "-x y"], { board });
  expect(usage.code).toBe(2);
  expect(usage.err.split("\n")).toHaveLength(1);
  expect(usage.err).toMatch(/^error: .*--description/);
});

test("confirmations stay on one line too", async () => {
  const board = fixtureBoard();
  board.lanes[0].cards[0].title = "Seven\n#99 deleted: Other";
  expect((await cli(["delete", "7"], { board })).out).toBe("#7 deleted: Seven #99 deleted: Other");
  const moved = fixtureBoard();
  moved.lanes[2].name = "Done\n#1 moved";
  expect((await cli(["move", "7", "done\n#1 moved"], { board: moved })).out).toBe("#7 moved to Done #1 moved");
});
