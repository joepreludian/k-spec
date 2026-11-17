// @vitest-environment node
import { boardFromFiles } from "./board-from-files.js";
import { KspecFormatError, cardNumberOf, slugify, toCamel, toSnake } from "./format.js";

const M = "2026-11-10T10:00:00.000Z";
const card = (dir, cardYaml, files = []) => ({ dir, cardYaml, modifiedAt: M, files });
const tree = (lanes = {}, boardYaml = null) => ({
  boardYaml,
  lanes: Object.fromEntries(
    Object.entries(lanes).map(([folder, l]) => [
      folder,
      Array.isArray(l) ? { cardsYaml: null, cards: l } : l,
    ]),
  ),
});
const BOARD = `
name: My board
next_card_number: 20
project:
  name: acme/app
  readme: README.md
  links:
    - { title: Repo, url: https://example.com/repo }
labels:
  - { name: spec, color: blue }
  - { name: Needs Review, color: red }
preferences: { anything: 1 }
`;
const failure = (t) => {
  try {
    boardFromFiles(t);
  } catch (error) {
    return error;
  }
  return null;
};

describe("format helpers", () => {
  test("slugify", () => {
    expect(slugify("File watcher for docs/k-spec")).toBe("file_watcher_for_docs_k_spec");
    expect(slugify("  --Hi!! ")).toBe("hi");
    expect(slugify("a".repeat(60)).length).toBe(40);
    expect(slugify("abc ".repeat(20)).endsWith("_")).toBe(false);
  });

  test("cardNumberOf", () => {
    expect(cardNumberOf("3_file_watcher")).toBe(3);
    expect(cardNumberOf("12")).toBe(12);
    expect(cardNumberOf("3x")).toBeNull();
    expect(cardNumberOf("notes")).toBeNull();
    expect(cardNumberOf("0_zero")).toBeNull();
  });

  test("toCamel and toSnake convert keys deeply and leave values alone", () => {
    const snake = { last_tool: { name: "Bash", at: "x" }, items: [{ worktree_path: "a_b" }], n: null };
    const camel = { lastTool: { name: "Bash", at: "x" }, items: [{ worktreePath: "a_b" }], n: null };
    expect(toCamel(snake)).toEqual(camel);
    expect(toSnake(camel)).toEqual(snake);
  });
});

describe("board", () => {
  test("an empty tree is the five empty lanes with defaults", () => {
    const board = boardFromFiles(tree());
    expect(board.id).toBe("board-1");
    expect(board.name).toBe("k-spec");
    expect(board.nextCardNumber).toBe(1);
    expect(board.labels).toEqual([]);
    expect(board.project).toEqual({ name: "", links: [], readmePath: null });
    expect(board.lanes).toEqual([
      { id: "lane-backlog", name: "Backlog", cards: [] },
      { id: "lane-todo", name: "Todo", cards: [] },
      { id: "lane-in-progress", name: "In Progress", cards: [] },
      { id: "lane-review", name: "Review", cards: [] },
      { id: "lane-done", name: "Done", cards: [] },
    ]);
  });

  test("board.yaml gives name, project, labels and the counter", () => {
    const board = boardFromFiles(tree({}, BOARD));
    expect(board.name).toBe("My board");
    expect(board.nextCardNumber).toBe(20);
    expect(board.project).toEqual({
      name: "acme/app",
      links: [{ id: "project-link-1", title: "Repo", url: "https://example.com/repo" }],
      readmePath: "README.md",
    });
    expect(board.labels).toEqual([
      { id: "label-spec", name: "spec", color: "blue" },
      { id: "label-needs_review", name: "Needs Review", color: "red" },
    ]);
  });

  test("the counter is never below the highest card number plus one", () => {
    const board = boardFromFiles(tree({ todo: [card("31_x", "title: X")] }, "next_card_number: 4"));
    expect(board.nextCardNumber).toBe(32);
  });

  test("unknown lane folders are ignored", () => {
    const board = boardFromFiles(tree({ archive: [card("1_x", "title: X")] }));
    expect(board.lanes.flatMap((l) => l.cards)).toEqual([]);
  });
});

describe("card order", () => {
  const cards = [card("5_e", "title: E"), card("2_b", "title: B"), card("9_i", "title: I")];
  const numbers = (t) => boardFromFiles(t).lanes[1].cards.map((c) => c.number);

  test("without cards.yaml cards go by number", () => {
    expect(numbers(tree({ todo: cards }))).toEqual([2, 5, 9]);
  });

  test("listed cards first in the listed order, unlisted after by number, missing skipped", () => {
    expect(numbers(tree({ todo: { cardsYaml: "order: [9, 77, 2]", cards } }))).toEqual([9, 2, 5]);
  });
});

describe("card", () => {
  test("only a title is needed; the rest defaults", () => {
    const [c] = boardFromFiles(tree({ backlog: [card("7_draft", "title: Draft")] })).lanes[0].cards;
    expect(c).toEqual({
      id: "card-7",
      number: 7,
      title: "Draft",
      description: "",
      labelIds: [],
      agentStatus: "idle",
      checklists: [],
      comments: [],
      links: [],
      work: null,
      workHistory: [],
      events: [],
      createdAt: M,
      updatedAt: M,
    });
  });

  test("reads every field and builds ids by position", () => {
    const yaml = `
number: 3
title: Watcher
description: |
  Line one.
  Line two.
labels: [Needs Review, spec]
agent_status: waiting-for-input
unknown_key: ignored
checklists:
  - title: Steps
    items:
      - { text: one, done: true }
      - { text: two }
comments:
  - author: { kind: agent, name: claude }
    at: 2026-11-14T07:00:00.000Z
    body: Hello
work:
  location: { kind: lima, name: vm }
  branch: feat/x
  worktree_path: ~/work
  started_at: 2026-11-14T06:00:00.000Z
  session:
    id: s1
    model: m
    tokens: { input: 1, output: 2, cached: 3 }
    turns: 4
    last_tool: { name: Bash, at: 2026-11-14T06:30:00.000Z }
    last_activity_at: 2026-11-14T06:31:00.000Z
  services:
    - { url: http://localhost:8002 }
    - { title: App, url: http://vm.local:3000 }
work_history:
  - location: { kind: host, name: mac }
    branch: main
    started_at: 2026-11-13T06:00:00.000Z
    ended_at: 2026-11-14T06:00:00.000Z
events:
  - { type: work-started, location: { kind: host, name: mac }, branch: main, at: 2026-11-13T06:00:00.000Z }
  - { type: status-changed, from: idle, to: waiting-for-input, at: 2026-11-14T06:10:00.000Z }
created_at: 2026-11-12T09:00:00.000Z
updated_at: 2026-11-14T08:00:00.000Z
`;
    const [c] = boardFromFiles(tree({ review: [card("3_watcher", yaml)] }, BOARD)).lanes[3].cards;
    expect(c.id).toBe("card-3");
    expect(c.description).toBe("Line one.\nLine two.\n");
    expect(c.labelIds).toEqual(["label-needs_review", "label-spec"]);
    expect(c.agentStatus).toBe("waiting-for-input");
    expect(c.checklists).toEqual([
      {
        id: "card-3-checklist-1",
        title: "Steps",
        items: [
          { id: "card-3-checklist-1-item-1", text: "one", done: true },
          { id: "card-3-checklist-1-item-2", text: "two", done: false },
        ],
      },
    ]);
    expect(c.comments).toEqual([
      { id: "card-3-comment-1", author: { kind: "agent", name: "claude" }, body: "Hello", createdAt: "2026-11-14T07:00:00.000Z" },
    ]);
    expect(c.work).toEqual({
      location: { kind: "lima", name: "vm" },
      branch: "feat/x",
      worktreePath: "~/work",
      startedAt: "2026-11-14T06:00:00.000Z",
      session: {
        id: "s1",
        model: "m",
        tokens: { input: 1, output: 2, cached: 3 },
        turns: 4,
        lastTool: { name: "Bash", at: "2026-11-14T06:30:00.000Z" },
        lastActivityAt: "2026-11-14T06:31:00.000Z",
      },
      services: [
        { id: "card-3-service-1", title: "localhost:8002", url: "http://localhost:8002" },
        { id: "card-3-service-2", title: "App", url: "http://vm.local:3000" },
      ],
    });
    expect(c.workHistory).toEqual([
      {
        location: { kind: "host", name: "mac" },
        branch: "main",
        worktreePath: null,
        startedAt: "2026-11-13T06:00:00.000Z",
        session: null,
        services: [],
        endedAt: "2026-11-14T06:00:00.000Z",
      },
    ]);
    expect(c.events).toEqual([
      { type: "work-started", location: { kind: "host", name: "mac" }, branch: "main", at: "2026-11-13T06:00:00.000Z" },
      { type: "status-changed", from: "idle", to: "waiting-for-input", at: "2026-11-14T06:10:00.000Z" },
    ]);
    expect(c.createdAt).toBe("2026-11-12T09:00:00.000Z");
    expect(c.updatedAt).toBe("2026-11-14T08:00:00.000Z");
  });

  test("markdown files in files/ become links sorted by name; other files are ignored", () => {
    const [c] = boardFromFiles(
      tree({ todo: [card("4_x", "title: X", ["plan.md", "design.md", "notes.txt", "Old Spec.markdown"])] }),
    ).lanes[1].cards;
    expect(c.links).toEqual([
      { id: "card-4-file-Old Spec.markdown", title: "Old Spec", path: "kspec-cards/4/Old Spec.markdown" },
      { id: "card-4-file-design.md", title: "design", path: "kspec-cards/4/design.md" },
      { id: "card-4-file-plan.md", title: "plan", path: "kspec-cards/4/plan.md" },
    ]);
  });
});

describe("errors name the file", () => {
  const cases = [
    ["unparsable board.yaml", tree({}, "name: [unclosed"), "board.yaml"],
    ["board.yaml that is a list", tree({}, "- a"), "board.yaml"],
    ["unknown label colour", tree({}, "labels: [{ name: x, color: neon }]"), "board.yaml"],
    ["unparsable cards.yaml", tree({ todo: { cardsYaml: "order: [1", cards: [] } }), "lanes/todo/cards.yaml"],
    ["order that is not a list of integers", tree({ todo: { cardsYaml: "order: [a, 2]", cards: [] } }), "lanes/todo/cards.yaml"],
    ["unparsable card.yaml", tree({ todo: [card("1_x", "title: [x")] }), "lanes/todo/1_x/card.yaml"],
    ["missing card.yaml", tree({ todo: [card("1_x", null)] }), "lanes/todo/1_x/card.yaml"],
    ["card without a title", tree({ todo: [card("1_x", "description: hi")] }), "lanes/todo/1_x/card.yaml"],
    ["unknown agent status", tree({ todo: [card("1_x", "title: X\nagent_status: sleeping")] }), "lanes/todo/1_x/card.yaml"],
    ["label not defined on the board", tree({ todo: [card("1_x", "title: X\nlabels: [ghost]")] }), "lanes/todo/1_x/card.yaml"],
    ["number disagreeing with the folder", tree({ todo: [card("1_x", "title: X\nnumber: 2")] }), "lanes/todo/1_x/card.yaml"],
    ["invalid work block", tree({ todo: [card("1_x", "title: X\nwork: { branch: main }")] }), "lanes/todo/1_x/card.yaml"],
    ["invalid service url", tree({ todo: [card("1_x", "title: X\nwork: { location: { kind: host, name: m }, branch: b, services: [{ url: 'javascript:1' }] }")] }), "lanes/todo/1_x/card.yaml"],
  ];

  test.each(cases)("%s", (_name, t, file) => {
    const error = failure(t);
    expect(error).toBeInstanceOf(KspecFormatError);
    expect(error.file).toBe(file);
    expect(error.message.length).toBeGreaterThan(0);
  });

  test("the same card number in two folders names both", () => {
    const error = failure(tree({ todo: [card("3_a", "title: A")], done: [card("3_b", "title: B")] }));
    expect(error).toBeInstanceOf(KspecFormatError);
    expect(error.message).toContain("lanes/todo/3_a");
    expect(error.message).toContain("lanes/done/3_b");
  });
});
