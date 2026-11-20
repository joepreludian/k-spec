// @vitest-environment node
import {
  ENV_KEYS,
  mergeEnv,
  readComposeHeader,
  readEnv,
  renderCompose,
  renderGitignore,
  renderProjectSkill,
  slugOf,
} from "./project-files.js";

const project = (name, slug = slugOf(name)) => ({ image: "k-spec:dev", name, slug, projectId: "abc123" });

test.each([
  ["My App", "my-app"],
  ["  k-spec_2.0!  ", "k-spec-2-0"],
  ["UPPER lower", "upper-lower"],
  ["a--b", "a-b"],
  ["日本語", ""],
  ["---", ""],
])("slug of %j is %j", (name, slug) => expect(slugOf(name)).toBe(slug));

test("a slug is at most 40 characters and never ends in a dash", () => {
  const slug = slugOf(`${"a".repeat(39)} ${"b".repeat(20)}`);
  expect(slug).toBe("a".repeat(39));
  expect(slugOf("x".repeat(60))).toHaveLength(40);
});

test("the compose file is the board service the project runs", () => {
  const text = renderCompose(project("My App"));
  const lines = text.split("\n");
  for (const line of [
    'name: "${K_SPEC_BOARD_PROJECT:?this machine has no settings yet - run k-spec init in this project}"',
    "  k-spec:",
    "    image: k-spec:dev",
    "    container_name: k-spec-my-app",
    '    user: "${K_SPEC_BOARD_UID:?}:${K_SPEC_BOARD_GID:?}"',
    "    restart: unless-stopped",
    '      - "${K_SPEC_BOARD_PORT:?}:${K_SPEC_BOARD_PORT:?}"',
    '      PORT: "${K_SPEC_BOARD_PORT:?}"',
    '      K_SPEC_TOKEN: "${K_SPEC_BOARD_TOKEN:?}"',
    '      K_SPEC_HOST: "${K_SPEC_BOARD_HOST:-localhost}"',
    '      K_SPEC_BOARD_NAME: "My App"',
    '      K_SPEC_NOTE_URL: "http://k-spec:${K_SPEC_BOARD_PORT:?}"',
    "      - ./data:/data",
    "      - ..:/project:ro",
    '      k-spec.project: "abc123"',
    "    name: k-spec-my-app",
  ]) {
    expect(lines).toContain(line);
  }
  expect(text.endsWith("\n")).toBe(true);
  expect(text).not.toContain("\t");
  // It says who wrote it, and that editing it is pointless.
  expect(lines[1]).toContain("k-spec init");
});

const ODD_NAMES = ["My App", `a "q" 'p' #x: y`, "cost $5 `now` $(id)", "Ünïcode ✓ 日本語", "back\\slash"];

test.each(ODD_NAMES)("the project can be read back from the compose file: %s", (name) => {
  const slug = slugOf(name) || "p12345678";
  const text = renderCompose(project(name, slug));
  expect(readComposeHeader(text)).toEqual({ id: "abc123", name, slug });
  expect(text.split("\n")[0].startsWith("# k-spec-project: ")).toBe(true);
});

test("a board name is written so that neither YAML nor Compose changes it", () => {
  const line = (name) =>
    renderCompose(project(name, "x"))
      .split("\n")
      .find((l) => l.includes("K_SPEC_BOARD_NAME"));
  // Compose would fill in $5 as a variable; a doubled $ is its way of writing one.
  expect(line("cost $5")).toBe('      K_SPEC_BOARD_NAME: "cost $$5"');
  expect(line('say "hi" #1: ok')).toBe('      K_SPEC_BOARD_NAME: "say \\"hi\\" #1: ok"');
  expect(line("${HOME}")).toBe('      K_SPEC_BOARD_NAME: "$${HOME}"');
});

test("no token is ever written into the compose file", () => {
  const text = renderCompose(project("My App"));
  const tokenLines = text.split("\n").filter((line) => /TOKEN/.test(line) && !line.trimStart().startsWith("#"));
  expect(tokenLines).toEqual(['      K_SPEC_TOKEN: "${K_SPEC_BOARD_TOKEN:?}"']);
});

test.each([
  ["nothing", ""],
  ["a compose file someone wrote", "services:\n  web:\n    image: x\n"],
  ["broken JSON", "# k-spec-project: {nope\nservices:\n"],
  ["a missing field", '# k-spec-project: {"id":"a","name":"n"}\n'],
  ["a field of the wrong kind", '# k-spec-project: {"id":"a","name":"n","slug":5}\n'],
  ["an empty id", '# k-spec-project: {"id":"","name":"n","slug":"s"}\n'],
  ["a header that is not first", 'x\n# k-spec-project: {"id":"a","name":"n","slug":"s"}\n'],
  ["JSON that is not an object", "# k-spec-project: null\n"],
])("no project is read from %s", (_, text) => expect(readComposeHeader(text)).toBeNull());

test("the settings file is read line by line; anything that is not KEY=VALUE is skipped", () => {
  expect(readEnv("# c\nA=1\n\nB=x=y\r\nnot a line\n  C = spaced  \n=nokey\n")).toEqual({ A: "1", B: "x=y", C: "spaced" });
  expect(readEnv("")).toEqual({});
});

test("the settings keys are not names the server or the CLI read", () => {
  expect(ENV_KEYS).toEqual({
    token: "K_SPEC_BOARD_TOKEN",
    port: "K_SPEC_BOARD_PORT",
    host: "K_SPEC_BOARD_HOST",
    uid: "K_SPEC_BOARD_UID",
    gid: "K_SPEC_BOARD_GID",
    project: "K_SPEC_BOARD_PROJECT",
  });
  for (const key of Object.values(ENV_KEYS)) {
    expect(["K_SPEC_TOKEN", "K_SPEC_HOST", "K_SPEC_URL", "PORT", "COMPOSE_PROJECT_NAME"]).not.toContain(key);
  }
});

const ALL = {
  K_SPEC_BOARD_PROJECT: "k-spec-my-app-a1b2c3",
  K_SPEC_BOARD_GID: "1000",
  K_SPEC_BOARD_UID: "501",
  K_SPEC_BOARD_HOST: "localhost",
  K_SPEC_BOARD_PORT: "14201",
  K_SPEC_BOARD_TOKEN: "tok",
};

test("a new settings file says what it is and lists the keys in a fixed order", () => {
  const text = mergeEnv(null, ALL);
  const lines = text.split("\n");
  expect(lines[0].startsWith("#")).toBe(true);
  expect(lines.filter((line) => !line.startsWith("#") && line !== "")).toEqual([
    "K_SPEC_BOARD_TOKEN=tok",
    "K_SPEC_BOARD_PORT=14201",
    "K_SPEC_BOARD_HOST=localhost",
    "K_SPEC_BOARD_UID=501",
    "K_SPEC_BOARD_GID=1000",
    "K_SPEC_BOARD_PROJECT=k-spec-my-app-a1b2c3",
  ]);
  expect(text.endsWith("\n")).toBe(true);
  expect(text.endsWith("\n\n")).toBe(false);
  expect(readEnv(text)).toEqual(ALL);
});

test("an existing settings file keeps every line; only the given keys change, missing ones are added", () => {
  const before = "# mine\nFOO=1\nK_SPEC_BOARD_PORT=14201\n\nK_SPEC_BOARD_TOKEN=tok\n";
  expect(mergeEnv(before, { K_SPEC_BOARD_PORT: "15000", K_SPEC_BOARD_HOST: "box" })).toBe(
    "# mine\nFOO=1\nK_SPEC_BOARD_PORT=15000\n\nK_SPEC_BOARD_TOKEN=tok\nK_SPEC_BOARD_HOST=box\n",
  );
  expect(mergeEnv(before, {})).toBe(before);
  // A file that did not end in a newline gets one before anything is added.
  expect(mergeEnv("A=1", { K_SPEC_BOARD_HOST: "box" })).toBe("A=1\nK_SPEC_BOARD_HOST=box\n");
});

test("the ignore file keeps the settings, the database and the server's note out of git", () => {
  const lines = renderGitignore().split("\n");
  for (const line of [".env", "data/*.db*", "data/k-spec.server.json"]) expect(lines).toContain(line);
  expect(lines).not.toContain("data/k-spec.dump.json");
  expect(lines).not.toContain("data/");
});

test("a project's copy of the skill says, right after the front matter, that the command is the launcher", () => {
  const source = "---\nname: k-spec\ndescription: d\n---\n\n# Title\nbody `k-spec board`\n";
  const copy = renderProjectSkill(source);
  const start = "---\nname: k-spec\ndescription: d\n---\n\n> **In this project the `k-spec` command is the file `.k-spec/k-spec`**";
  expect(copy.startsWith(start)).toBe(true);
  expect(copy).toContain("`.k-spec/k-spec watch`");
  expect(copy).toContain(".k-spec/data/");
  expect(copy.endsWith("\n\n# Title\nbody `k-spec board`\n")).toBe(true);
  expect(() => renderProjectSkill("# no front matter\n")).toThrow("the skill has no front matter");
});
