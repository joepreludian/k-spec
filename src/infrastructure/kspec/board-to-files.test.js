// @vitest-environment node
import { parse } from "yaml";
import { seedBoard } from "../seed-board.js";
import { boardFromFiles } from "./board-from-files.js";
import { boardToFiles, cardDir } from "./board-to-files.js";
import { treeOf } from "./tree-of.js";

const seed = seedBoard();
const files = boardToFiles(seed);
const seedCard = (board, number) => board.lanes.flatMap((l) => l.cards).find((c) => c.number === number);

test("cardDir is the lane folder plus number and title slug", () => {
  const lane = seed.lanes[2];
  expect(cardDir(lane, seedCard(seed, 3))).toBe("lanes/in_progress/3_file_watcher_for_docs_k_spec");
});

test("writes board.yaml, a cards.yaml per lane and a card.yaml per card", () => {
  const paths = Object.keys(files);
  expect(paths).toContain("board.yaml");
  for (const folder of ["backlog", "todo", "in_progress", "review", "done"]) {
    expect(paths).toContain(`lanes/${folder}/cards.yaml`);
  }
  expect(paths.filter((p) => p.endsWith("/card.yaml"))).toHaveLength(8);
  expect(paths).toContain("lanes/in_progress/3_file_watcher_for_docs_k_spec/card.yaml");
  expect(parse(files["lanes/in_progress/cards.yaml"])).toEqual({ order: [3, 4] });
});

test("board.yaml holds the shared board data without ids", () => {
  expect(parse(files["board.yaml"])).toEqual({
    name: "k-spec",
    next_card_number: 9,
    project: {
      name: "opensource/k-spec",
      readme: "README.md",
      links: [{ title: "Repo", url: "https://github.com/opensource/k-spec" }],
    },
    labels: [
      { name: "spec", color: "blue" },
      { name: "bug", color: "red" },
      { name: "cli", color: "violet" },
      { name: "ui", color: "teal" },
      { name: "infra", color: "amber" },
    ],
    preferences: {},
  });
});

test("a card.yaml uses label names, snake_case keys and omits what is empty", () => {
  const minimal = parse(files["lanes/backlog/8_drag_preview_flickers_on_firefox/card.yaml"]);
  expect(Object.keys(minimal)).toEqual(["title", "labels", "created_at", "updated_at"]);
  expect(minimal.labels).toEqual(["bug", "ui"]);

  const full = parse(files["lanes/in_progress/3_file_watcher_for_docs_k_spec/card.yaml"]);
  expect(full.agent_status).toBe("working");
  expect(full.work.worktree_path).toBe("~/work/k-spec");
  expect(full.work.session.last_tool.name).toBe("Bash");
  expect(full.work.services).toEqual([
    { title: "lima-dev-k-spec-main.local:3000", url: "http://lima-dev-k-spec-main.local:3000" },
    { title: "localhost:8002", url: "http://localhost:8002" },
  ]);
  expect(full.work_history).toHaveLength(1);
  expect(full.links).toBeUndefined();
});

test("no file carries an id, apart from the Claude session id", () => {
  const offenders = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "id" && !path.endsWith("session")) offenders.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    }
  };
  for (const [path, source] of Object.entries(files)) walk(parse(source), path);
  expect(offenders).toEqual([]);
});

test("a lane outside the fixed five cannot be written", () => {
  const odd = { ...seed, lanes: [...seed.lanes, { id: "lane-qa", name: "QA", cards: [] }] };
  expect(() => boardToFiles(odd)).toThrow(/lane-qa/);
});

test("the seed survives a trip through the files, apart from ids and links", () => {
  const back = boardFromFiles(treeOf(files));
  expect(back.name).toBe(seed.name);
  expect(back.nextCardNumber).toBe(seed.nextCardNumber);
  expect(back.project.name).toBe(seed.project.name);
  expect(back.labels.map(({ name, color }) => ({ name, color }))).toEqual(
    seed.labels.map(({ name, color }) => ({ name, color })),
  );
  expect(back.lanes.map((l) => [l.name, l.cards.map((c) => c.number)])).toEqual(
    seed.lanes.map((l) => [l.name, l.cards.map((c) => c.number)]),
  );

  const labelNames = (board, card) => card.labelIds.map((id) => board.labels.find((l) => l.id === id).name);
  const withoutIds = (value) =>
    JSON.parse(JSON.stringify(value, (key, v) => (key === "id" && typeof v === "string" && !/^[0-9a-f-]{36}$/.test(v) ? undefined : v)));

  for (const lane of seed.lanes) {
    for (const original of lane.cards) {
      const loaded = seedCard(back, original.number);
      expect(labelNames(back, loaded)).toEqual(labelNames(seed, original));
      const { links: _l1, labelIds: _i1, ...a } = withoutIds(loaded);
      const { links: _l2, labelIds: _i2, ...b } = withoutIds(original);
      expect(a).toEqual(b);
    }
  }
});

test("writing what was read gives the same files", () => {
  expect(boardToFiles(boardFromFiles(treeOf(files)))).toEqual(files);
});
