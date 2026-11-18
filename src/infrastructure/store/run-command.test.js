// @vitest-environment node
import { fixedClock } from "@/infrastructure/clock.js";
import { sequentialIdGenerator } from "@/infrastructure/id-generator.js";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { createCommandQueue } from "./command-queue.js";
import { openDatabase } from "./open-database.js";
import { runCommand } from "./run-command.js";
import { createSqliteBoardRepository } from "./sqlite-board-repository.js";

const JSON_TYPE = "application/json";
let database;
let repository;
let deps;
let queue;
const post = (name, input, extra = {}) =>
  runCommand({ deps, queue, name, contentType: JSON_TYPE, text: JSON.stringify(input), ...extra });
const cards = async () => (await repository.load()).lanes.flatMap((l) => l.cards);

beforeEach(() => {
  database = openDatabase(":memory:");
  repository = createSqliteBoardRepository(database.db);
  repository.replaceSync(seedBoard());
  deps = { repository, clock: fixedClock("2026-11-14T10:00:00.000Z"), idGenerator: sequentialIdGenerator("new") };
  queue = createCommandQueue();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  database.close();
  vi.restoreAllMocks();
});

test("a command answers 200 with its result and the new version, and is stored", async () => {
  const { status, body } = await post("createCard", { laneId: "lane-backlog", title: "New" });
  expect(status).toBe(200);
  expect(body.id).toBe("new-1");
  expect(body.version).toBe(2);
  expect(body.board.lanes[0].cards.some((c) => c.title === "New")).toBe(true);
  expect((await cards()).some((c) => c.id === "new-1")).toBe(true);
});

test("a broken domain rule answers 422 with the message and code, nothing saved", async () => {
  const { status, body } = await post("createCard", { laneId: "lane-backlog", title: "  " });
  expect(status).toBe(422);
  expect(body).toEqual({ error: "Title cannot be empty", code: "EMPTY_TITLE" });
  expect(repository.version()).toBe(1);
});

test.each(["nope", "getBoard", "constructor", "__proto__", "toString"])("%s is not a command: 404", async (name) => {
  const { status, body } = await post(name, {});
  expect(status).toBe(404);
  expect(body).toEqual({ error: `Unknown command: ${name}` });
});

test.each(["nope", "[1]", "null", "", '"text"', "5"])("body %j is not a JSON object: 400", async (text) => {
  const { status, body } = await post("createCard", {}, { text });
  expect(status).toBe(400);
  expect(body).toEqual({ error: "Body must be a JSON object" });
});

test.each(["text/plain", undefined, null, "application/x-www-form-urlencoded"])(
  "content type %s is refused: 415",
  async (contentType) => {
    const { status, body } = await post("createCard", { laneId: "lane-backlog", title: "x" }, { contentType });
    expect(status).toBe(415);
    expect(body).toEqual({ error: "Content-Type must be application/json" });
    expect(repository.version()).toBe(1);
  },
);

test("a charset on the content type is fine", async () => {
  const { status } = await post(
    "createCard",
    { laneId: "lane-backlog", title: "x" },
    { contentType: "application/json; charset=utf-8" },
  );
  expect(status).toBe(200);
});

test("any other failure answers 500 without details, nothing saved", async () => {
  const { status, body } = await post("setProject", { name: "x", links: 5 });
  expect(status).toBe(500);
  expect(body).toEqual({ error: "Command failed" });
  expect(repository.version()).toBe(1);
  expect(console.error).toHaveBeenCalled();
});

test("two commands sent at the same moment both take effect", async () => {
  // Make the gap between load and save real, as it is with any awaiting repository.
  const slow = {
    ...repository,
    load: async () => {
      const board = await repository.load();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return board;
    },
  };
  deps = { ...deps, repository: slow };
  const [a, b] = await Promise.all([
    post("createCard", { laneId: "lane-backlog", title: "A" }),
    post("createCard", { laneId: "lane-backlog", title: "B" }),
  ]);
  expect([a.status, b.status]).toEqual([200, 200]);
  const stored = await cards();
  const made = stored.filter((c) => c.title === "A" || c.title === "B");
  expect(made.map((c) => c.title).sort()).toEqual(["A", "B"]);
  expect(new Set(made.map((c) => c.number)).size).toBe(2);
  expect(repository.version()).toBe(3);
});
