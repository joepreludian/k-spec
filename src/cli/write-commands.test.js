// @vitest-environment node
import { cardByNumber } from "@/application/board-lookup.js";
import { COMMANDS } from "@/application/commands.js";
import { COMMAND_HANDLERS, USAGE } from "./main.js";
import { cli, fixtureBoard } from "./test-cli.js";

const posts = (server) => server.requests.filter((r) => r.method === "POST").map((r) => [r.path.split("/").pop(), r.input]);
const after = (server) => server.repository.load();
const run = (args, options = {}) => cli(args, { board: fixtureBoard(), ...options });

test("usage names every command", () => {
  for (const [name, command] of Object.entries(COMMAND_HANDLERS)) {
    expect(command.usage.split(" ")[0]).toBe(name);
    expect(USAGE).toContain(`  ${command.usage}`);
  }
  expect(Object.keys(COMMAND_HANDLERS)).toEqual([
    "board", "show", "comment", "status", "move", "check", "uncheck", "add", "delete", "start", "end", "publish", "unpublish", "run",
  ]);
});

test("a comment is the person's unless the caller says it is an agent", async () => {
  const human = await run(["comment", "7", "Looks good"]);
  expect([human.code, human.out, human.err]).toEqual([0, "#7 comment added", ""]);
  expect(posts(human.server)).toEqual([["addComment", { cardId: "card-7", body: "Looks good" }]]);
  expect(cardByNumber(await after(human.server), 7).card.comments.at(-1).author).toEqual({ kind: "person", name: "You" });

  const flag = await run(["comment", "7", "Done", "--agent", "Claude"]);
  expect(posts(flag.server)[0][1].author).toEqual({ kind: "agent", name: "Claude" });
  expect(cardByNumber(await after(flag.server), 7).card.comments.at(-1).author).toEqual({ kind: "agent", name: "Claude" });
  const env = await run(["comment", "7", "Done"], { env: { K_SPEC_AGENT: "Opus" } });
  expect(posts(env.server)[0][1].author).toEqual({ kind: "agent", name: "Opus" });
  const both = await run(["comment", "7", "Done", "--agent", "Claude"], { env: { K_SPEC_AGENT: "Opus" } });
  expect(posts(both.server)[0][1].author.name).toBe("Claude");
  const blank = await run(["comment", "7", "Done"], { env: { K_SPEC_AGENT: " " } });
  expect(posts(blank.server)[0][1].author).toBeUndefined();
});

test("--agent needs a name", async () => {
  for (const args of [["comment", "7", "Done", "--agent"], ["comment", "7", "Done", "--agent", " "], ["comment", "7", "Done", "--agent="]]) {
    const result = await run(args);
    expect(result.code).toBe(2);
    expect(posts(result.server)).toEqual([]);
  }
});

test("text that starts with a dash goes after --, and is refused without it", async () => {
  const ok = await run(["comment", "7", "--", "-1 from me"]);
  expect(posts(ok.server)[0][1].body).toBe("-1 from me");
  for (const text of ["--force", "-1 from me"]) {
    const bad = await run(["comment", "7", text]);
    expect(bad.code).toBe(2);
    expect(posts(bad.server)).toEqual([]);
  }
  const title = await run(["add", "backlog", "--", "--force is ignored"]);
  expect(posts(title.server)[0][1].title).toBe("--force is ignored");
});

test("- reads the text from stdin, dropping one trailing newline only", async () => {
  const many = await run(["comment", "7", "-"], { stdin: "line one\n\nline three\n" });
  expect(posts(many.server)[0][1].body).toBe("line one\n\nline three");
  const crlf = await run(["comment", "7", "-"], { stdin: "x\r\n" });
  expect(posts(crlf.server)[0][1].body).toBe("x");
  const two = await run(["comment", "7", "-"], { stdin: "x\n\n" });
  expect(posts(two.server)[0][1].body).toBe("x\n");
  const empty = await run(["comment", "7", "-"], { stdin: "" });
  expect(empty.code).toBe(1); // sent as is; the server refuses empty text
  expect(empty.err).toMatch(/^error: /);
  expect(empty.out).toBe("");
});

test("status accepts the short form and the server refuses nonsense", async () => {
  const ok = await run(["status", "4", "waiting"]);
  expect(ok.out).toBe("#4 status waiting-for-input");
  expect(cardByNumber(await after(ok.server), 4).card.agentStatus).toBe("waiting-for-input");
  const bad = await run(["status", "4", "asleep"]);
  expect(bad.code).toBe(1);
  expect(bad.err).toMatch(/^error: .*asleep/);
});

test("move puts the card at the end of the lane, or the top", async () => {
  const end = await run(["move", "4", "backlog"]);
  expect(end.out).toBe("#4 moved to Backlog");
  expect(posts(end.server)).toEqual([["moveCard", { cardId: "card-4", toLaneId: "lane-backlog" }]]);
  expect((await after(end.server)).lanes[0].cards.map((c) => c.number)).toEqual([7, 4]);
  const top = await run(["move", "4", "Backlog", "--top"]);
  expect((await after(top.server)).lanes[0].cards.map((c) => c.number)).toEqual([4, 7]);
  const none = await run(["move", "4", "Nowhere"]);
  expect([none.code, posts(none.server)]).toEqual([1, []]);
});

test("check and uncheck say what is now true and never toggle the wrong way", async () => {
  const check = await run(["check", "4", "1.2"]);
  expect(check.out).toBe("#4 1.2 checked");
  expect(posts(check.server)).toHaveLength(1);
  expect(cardByNumber(await after(check.server), 4).card.checklists[0].items[1].done).toBe(true);
  const again = await run(["check", "4", "1.1"]); // a1 is ticked in the fixture
  expect([again.code, again.out, posts(again.server)]).toEqual([0, "#4 1.1 already checked", []]);
  const uncheck = await run(["uncheck", "4", "1.1"]);
  expect(uncheck.out).toBe("#4 1.1 unchecked");
  expect(cardByNumber(await after(uncheck.server), 4).card.checklists[0].items[0].done).toBe(false);
  const noop = await run(["uncheck", "4", "1.2"]);
  expect([noop.out, posts(noop.server)]).toEqual(["#4 1.2 already unchecked", []]);
  for (const ref of ["1", "a.b", "9.9"]) {
    const bad = await run(["check", "4", ref]);
    expect([bad.code, posts(bad.server)]).toEqual([1, []]);
  }
});

test("add creates a card and prints its number", async () => {
  const added = await run(["add", "backlog", "Write the parser"]);
  const created = (await after(added.server)).lanes[0].cards.at(-1);
  expect(created.number).toBeGreaterThan(7);
  expect(added.out).toBe(`#${created.number} created in Backlog`);
  expect(created.title).toBe("Write the parser");
  expect(posts(added.server).map(([name]) => name)).toEqual(["createCard"]);
});

test("add can set the description, also from stdin", async () => {
  const added = await run(["add", "backlog", "T", "--description", "-"], { stdin: "# Spec\nbody\n" });
  expect((await after(added.server)).lanes[0].cards.at(-1).description).toBe("# Spec\nbody");
  expect(posts(added.server).map(([name]) => name)).toEqual(["createCard", "updateCardDescription"]);
  const inline = await run(["add", "backlog", "T", "--description", "short"]);
  expect((await after(inline.server)).lanes[0].cards.at(-1).description).toBe("short");
});

test("a refused title creates nothing", async () => {
  const refused = await run(["add", "backlog", " "]);
  expect(refused.code).toBe(1);
  expect((await after(refused.server)).lanes[0].cards).toHaveLength(1);
});

test("a description that fails after the card was made says the card exists", async () => {
  const half = await run(["add", "backlog", "T", "--description", "d"], {
    server: { refuse: (name) => name === "updateCardDescription" },
  });
  const created = (await after(half.server)).lanes[0].cards.at(-1);
  expect(half.code).toBe(1);
  expect(half.out).toBe("");
  expect(half.err).toBe(`error: #${created.number} created in Backlog, but its description was refused: Refused by the test`);
});

test("delete removes the card and names it", async () => {
  const gone = await run(["delete", "7"]);
  expect(gone.out).toBe("#7 deleted: Seven");
  expect((await after(gone.server)).lanes[0].cards).toEqual([]);
});

test("start uses the current branch and this machine unless told otherwise", async () => {
  const started = await run(["start", "7"]);
  expect(started.out).toBe("#7 work started on feat/x");
  expect(posts(started.server)[0][1]).toEqual({
    cardId: "card-7",
    location: { kind: "host", name: "box" },
    branch: "feat/x",
    worktreePath: null,
    session: null,
  });
  const told = await run(["start", "7", "--branch", "fix/y", "--location", "lima:dev", "--worktree", "/w/y"]);
  expect(posts(told.server)[0][1]).toMatchObject({ location: { kind: "lima", name: "dev" }, branch: "fix/y", worktreePath: "/w/y" });
  expect(told.out).toBe("#7 work started on fix/y");
  const named = await run(["start", "7", "--location", "worktree:a:b"]);
  expect(posts(named.server)[0][1].location).toEqual({ kind: "worktree", name: "a:b" });
});

test("start refuses to guess a branch or a location", async () => {
  const noBranch = await run(["start", "7"], { gitBranch: null });
  expect([noBranch.code, noBranch.err]).toEqual([2, "error: no git branch here; pass --branch <name>"]);
  expect((await run(["start", "7", "--branch", "b"], { gitBranch: null })).code).toBe(0);
  for (const location of ["laptop", ":x", "host:"]) {
    const bad = await run(["start", "7", "--location", location]);
    expect([bad.code, bad.err, posts(bad.server)]).toEqual([2, "error: location must be <kind>:<name>, e.g. host:laptop", []]);
  }
  expect((await run(["start", "7", "--location", "moon:base"])).code).toBe(1); // the server knows the kinds
});

test("end, publish and unpublish work on the active work", async () => {
  expect((await run(["publish", "4", "Api", "http://localhost:8080"])).out).toBe("#4 published Api");
  const un = await run(["unpublish", "4", "preview"]);
  expect(un.out).toBe("#4 unpublished Preview");
  expect(cardByNumber(await after(un.server), 4).card.work.services.map((s) => s.title)).toEqual(["Docs"]);
  expect((await run(["unpublish", "7", "Preview"])).err).toBe("error: Card #7 has no active work");
  const end = await run(["end", "4"]);
  expect(end.out).toBe("#4 work ended");
  expect(cardByNumber(await after(end.server), 4).card.work).toBeNull();
  expect((await run(["end", "7"])).code).toBe(1);
});

test("run reaches any other command with raw input", async () => {
  const made = await run(["run", "createLane", '{"name":"Review"}']);
  const answer = JSON.parse(made.out);
  expect(answer.board).toBeUndefined();
  expect(answer.version).toBe(2);
  expect((await after(made.server)).lanes.at(-1).name).toBe("Review");
  expect(made.server.requests.map((r) => r.method)).toEqual(["POST"]); // nothing to look up
  const full = await run(["run", "createLane", "-", "--board"], { stdin: '{"name":"R"}\n' });
  expect(JSON.parse(full.out).board.lanes).toHaveLength(4);
  const bare = await run(["run", "createLane"]);
  expect(bare.code).toBe(1); // {} has no name: the server's refusal
});

test.each([
  [["run", "getBoard"], "error: getBoard is not a command; use k-spec board --json"],
  [["run", "createLane", "[1]"], "error: input must be a JSON object"],
  [["run", "createLane", "{oops"], "error: input must be a JSON object"],
  [["run", "createLane", "null"], "error: input must be a JSON object"],
  [["run", "nope"], "error: unknown command: nope"],
])("%j is a usage error", async (args, message) => {
  const result = await run(args);
  expect([result.code, result.err, result.out]).toEqual([2, message, ""]);
});

test("--json on a write prints the server's answer without the board", async () => {
  const commented = JSON.parse((await run(["comment", "7", "x", "--json"])).out);
  expect(commented.board).toBeUndefined();
  expect(typeof commented.id).toBe("string");
  expect(commented.version).toBe(2);
  expect(JSON.parse((await run(["check", "4", "1.1", "--json"])).out)).toEqual({ changed: false });
  const added = JSON.parse((await run(["add", "backlog", "T", "--description", "d", "--json"])).out);
  expect(added.board).toBeUndefined();
  expect(added).toMatchObject({ number: 8, version: 3 });
  expect(typeof added.id).toBe("string");
});

test("a card removed between the lookup and the write is the server's not-found", async () => {
  const raced = await run(["comment", "7", "x"], {
    server: { afterRead: (server) => COMMANDS.deleteCard(server.deps, { cardId: "card-7" }) },
  });
  expect(raced.code).toBe(1);
  expect(raced.err).toMatch(/^error: Card .*not found/);
});
