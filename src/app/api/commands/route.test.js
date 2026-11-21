// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dumpOnShutdown, resetServerStore } from "@/infrastructure/store/server-store.js";
import { GET as getBoard } from "../board/route.js";
import { GET as getVersion } from "../board/version/route.js";
import { POST } from "./[name]/route.js";

let dir;
const saved = { db: process.env.K_SPEC_DB, dump: process.env.K_SPEC_DUMP, auto: process.env.K_SPEC_AUTO_DUMP };
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-cmd-"));
  process.env.K_SPEC_DB = path.join(dir, "k.db");
  process.env.K_SPEC_DUMP = path.join(dir, "k.dump.json");
  delete process.env.K_SPEC_AUTO_DUMP;
});
afterEach(() => {
  resetServerStore();
  restore("K_SPEC_DB", saved.db);
  restore("K_SPEC_DUMP", saved.dump);
  restore("K_SPEC_AUTO_DUMP", saved.auto);
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (name, input, headers = { "Content-Type": "application/json" }) =>
  POST(new Request(`http://localhost/api/commands/${name}`, { method: "POST", headers, body: JSON.stringify(input) }), {
    params: Promise.resolve({ name }),
  });

test("a posted command is stored and shows up in the board and its version", async () => {
  const before = await (await getBoard()).json();
  const card = before.board.lanes.flatMap((l) => l.cards)[0];
  const res = await post("updateCardTitle", { cardId: card.id, title: "Renamed on the server" });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json();
  expect(body.version).toBe(before.version + 1);
  const after = await (await getBoard()).json();
  expect(after.board.lanes.flatMap((l) => l.cards).find((c) => c.id === card.id).title).toBe("Renamed on the server");
  expect(await (await getVersion()).json()).toEqual({ version: body.version });
});

test("errors keep their status through the route", async () => {
  expect((await post("nope", {})).status).toBe(404);
  expect((await post("createCard", { laneId: "lane-backlog", title: "" })).status).toBe(422);
  expect((await post("createCard", { laneId: "lane-backlog", title: "x" }, { "Content-Type": "text/plain" })).status).toBe(415);
});

test("a board read while a command is being saved never pairs the old board with the new version", async () => {
  for (let gap = 0; gap < 12; gap += 1) {
    const title = `Raced ${gap}`;
    const posting = post("createCard", { laneId: "lane-backlog", title });
    for (let i = 0; i < gap; i += 1) await Promise.resolve();
    const got = await (await getBoard()).json();
    const posted = await (await posting).json();
    const hasCard = got.board.lanes[0].cards.some((c) => c.title === title);
    expect({ gap, hasCard }).toEqual({ gap, hasCard: got.version >= posted.version });
  }
});

const dumped = () => fs.readFileSync(process.env.K_SPEC_DUMP, "utf8");

test("a posted command is in the dump by the time its answer is back", async () => {
  const res = await post("createCard", { laneId: "lane-backlog", title: "Saved at once" });
  expect(res.status).toBe(200);
  expect(dumped()).toContain('"Saved at once"');
});

test("with saving off a posted command is not written until the server stops", async () => {
  process.env.K_SPEC_AUTO_DUMP = "off";
  expect((await post("createCard", { laneId: "lane-backlog", title: "Kept for the stop" })).status).toBe(200);
  expect(fs.existsSync(process.env.K_SPEC_DUMP)).toBe(false);
  expect(dumpOnShutdown()).toBe(true);
  expect(dumped()).toContain('"Kept for the stop"');
});

test("a dump that cannot be written does not fail the command, and the stop writes it", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await getBoard(); // opens the store, which writes the first dump
  fs.rmSync(process.env.K_SPEC_DUMP);
  fs.mkdirSync(process.env.K_SPEC_DUMP); // a folder sits where the file should go
  const res = await post("createCard", { laneId: "lane-backlog", title: "Held back" });
  expect(res.status).toBe(200);
  expect((await res.json()).board.lanes[0].cards.some((card) => card.title === "Held back")).toBe(true);
  fs.rmdirSync(process.env.K_SPEC_DUMP);
  expect(dumpOnShutdown()).toBe(true);
  expect(dumped()).toContain('"Held back"');
});
