// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetServerStore } from "@/infrastructure/store/server-store.js";
import { GET as getBoard } from "../board/route.js";
import { GET as getVersion } from "../board/version/route.js";
import { POST } from "./[name]/route.js";

let dir;
const saved = { db: process.env.K_SPEC_DB, dump: process.env.K_SPEC_DUMP };
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-cmd-"));
  process.env.K_SPEC_DB = path.join(dir, "k.db");
  process.env.K_SPEC_DUMP = path.join(dir, "k.dump.json");
});
afterEach(() => {
  resetServerStore();
  restore("K_SPEC_DB", saved.db);
  restore("K_SPEC_DUMP", saved.dump);
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
