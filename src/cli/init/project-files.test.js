// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  composeIncludesBoard,
  ENV_KEYS,
  mergeEnv,
  PROJECT_COMPOSE_FILES,
  readComposeHeader,
  readEnv,
  renderCompose,
  renderGitignore,
  renderProjectSkill,
  slugOf,
} from "./project-files.js";

const ID = "0123456789abcdef";
const project = (name, slug = slugOf(name)) => ({ image: "k-spec:dev", name, slug, projectId: ID });

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
    `      k-spec.project: "${ID}"`,
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
  expect(readComposeHeader(text)).toEqual({ id: ID, name, slug, autoDump: true });
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
  ["a missing field", `# k-spec-project: {"id":"${ID}","name":"n"}\n`],
  ["a field of the wrong kind", `# k-spec-project: {"id":"${ID}","name":"n","slug":5}\n`],
  ["an empty id", '# k-spec-project: {"id":"","name":"n","slug":"s"}\n'],
  ["a header that is not first", `x\n# k-spec-project: {"id":"${ID}","name":"n","slug":"s"}\n`],
  ["JSON that is not an object", "# k-spec-project: null\n"],
])("no project is read from %s", (_, text) => expect(readComposeHeader(text)).toBeNull());

// The id and the slug end up in a shell script and in YAML, and this line can come from a
// repository someone else wrote: only what init itself would have generated is taken.
test.each([
  ["an id that closes the launcher's quote", { id: "x'; touch INJECTED; : '", slug: "app" }],
  ["an id that adds YAML keys", { id: 'a"\n    privileged: true\n    pid: "host', slug: "app" }],
  ["an id that is not 16 hex characters", { id: "abc123", slug: "app" }],
  ["an id in upper case", { id: "0123456789ABCDEF", slug: "app" }],
  ["a slug that closes the launcher's quote", { id: ID, slug: "a'; touch INJECTED; : '" }],
  ["a slug with a space", { id: ID, slug: "my app" }],
  ["a slug in upper case", { id: ID, slug: "My-App" }],
  ["a slug that starts with a dash", { id: ID, slug: "-app" }],
  ["a slug that ends with a dash", { id: ID, slug: "app-" }],
  ["a slug of 41 characters", { id: ID, slug: "a".repeat(41) }],
  ["a slug with a newline", { id: ID, slug: "app\nx" }],
])("no project is read from a header with %s", (_, { id, slug }) => {
  expect(readComposeHeader(`# k-spec-project: ${JSON.stringify({ id, name: "Team App", slug })}\nservices:\n`)).toBeNull();
});

test("what init generates is always read back: a fallback slug, the longest slug", () => {
  for (const slug of ["p01234567", "a".repeat(40), "a-b-c", "x"]) {
    expect(readComposeHeader(renderCompose(project("Any", slug)))).toEqual({ id: ID, name: "Any", slug, autoDump: true });
  }
});

test("the settings file is read line by line; anything that is not KEY=VALUE is skipped", () => {
  expect(readEnv("# c\nA=1\n\nB=x=y\r\nnot a line\n  C = spaced  \n=nokey\n")).toEqual({ A: "1", B: "x=y", C: "spaced" });
  expect(readEnv("")).toEqual({});
});

test("the settings file is read the way Compose reads it: export, quotes, a comment after the value", () => {
  const text = [
    "export A=exported",
    "B=14271   # the port I like",
    'C="double quoted"',
    "D='single quoted'",
    "E=tok#en-with-hash",
    "F=",
    'G="quoted # not a comment"   # a comment',
    "export   H = spaced",
  ].join("\n");
  expect(readEnv(text)).toEqual({
    A: "exported",
    B: "14271",
    C: "double quoted",
    D: "single quoted",
    E: "tok#en-with-hash",
    F: "",
    G: "quoted # not a comment",
    H: "spaced",
  });
});

test("a key written with export is changed in place, not added a second time", () => {
  const before = "export K_SPEC_BOARD_TOKEN=tok\nK_SPEC_BOARD_PORT=14271   # the port I like\n";
  expect(mergeEnv(before, { K_SPEC_BOARD_TOKEN: "new" })).toBe("export K_SPEC_BOARD_TOKEN=new\nK_SPEC_BOARD_PORT=14271   # the port I like\n");
  expect(mergeEnv(before, { K_SPEC_BOARD_PORT: "15000" })).toBe("export K_SPEC_BOARD_TOKEN=tok\nK_SPEC_BOARD_PORT=15000\n");
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
  // Like every generated file, it says who writes it and that editing it is pointless.
  expect(lines[0]).toMatch(/^# .*k-spec init.*rewritten/);
});

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const hasGit = git(os.tmpdir(), "--version").status === 0;

// A project's own .gitignore often has a rule like `data/`. It must not take the board's dump
// out of git without anyone noticing: the dump is the part of the board that is committed.
test.skipIf(!hasGit).each([["data/"], ["data"], ["**/data/"], ["*.json\ndata/"]])("the dump is committed even when the project ignores %j", (rootRule) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-ignore-"));
  try {
    expect(git(dir, "init", "-q").status).toBe(0);
    fs.writeFileSync(path.join(dir, ".gitignore"), `${rootRule}\n`);
    fs.mkdirSync(path.join(dir, ".k-spec/data"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".k-spec/.gitignore"), renderGitignore());
    const files = [".k-spec/data/k-spec.dump.json", ".k-spec/data/k-spec.db", ".k-spec/data/k-spec.db-wal", ".k-spec/data/k-spec.server.json", ".k-spec/.env"];
    for (const file of files) fs.writeFileSync(path.join(dir, file), "");
    const ignored = files.filter((file) => git(dir, "check-ignore", "-q", file).status === 0);
    expect(ignored).toEqual(files.slice(1));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a project's copy of the skill says, right after the front matter, that the command is the launcher", () => {
  const source = "---\nname: k-spec\ndescription: d\n---\n\n# Title\nbody `k-spec board`\n";
  const copy = renderProjectSkill(source);
  const start = "---\nname: k-spec\ndescription: d\n---\n\n> **In this project the `k-spec` command is the file `.k-spec/k-spec`**";
  expect(copy.startsWith(start)).toBe(true);
  expect(copy).toContain("`.k-spec/k-spec watch`");
  // The dump is the board; with saving on every change there is no database beside it.
  expect(copy).toContain("`.k-spec/data/k-spec.dump.json`");
  expect(copy).not.toContain("database");
  // Whoever edits the copy must learn that the next init overwrites it.
  expect(copy).toMatch(/written by `k-spec init`[^.]*rewritten/);
  expect(copy.endsWith("\n\n# Title\nbody `k-spec board`\n")).toBe(true);
  expect(() => renderProjectSkill("# no front matter\n")).toThrow("the skill has no front matter");
});

test("the header carries the switch only when it is off", () => {
  const first = (options) => renderCompose({ ...project("My App"), ...options }).split("\n")[0];
  expect(first({ autoDump: false })).toBe(`# k-spec-project: {"id":"${ID}","name":"My App","slug":"my-app","autoDump":false}`);
  expect(first({ autoDump: true })).toBe(`# k-spec-project: {"id":"${ID}","name":"My App","slug":"my-app"}`);
  expect(first({})).toBe(first({ autoDump: true }));
});

test("the switch is read back, and only as the boolean false", () => {
  expect(readComposeHeader(renderCompose({ ...project("My App"), autoDump: false })).autoDump).toBe(false);
  const header = (extra) => `# k-spec-project: {"id":"${ID}","name":"n","slug":"s"${extra}}\n`;
  expect(readComposeHeader(header("")).autoDump).toBe(true);
  expect(readComposeHeader(header(',"autoDump":false')).autoDump).toBe(false);
  for (const value of ["true", '"false"', "0", "null", '"off"']) expect(readComposeHeader(header(`,"autoDump":${value}`))).toBeNull();
});

test("with saving on, the database is inside the container", () => {
  const text = renderCompose(project("My App"));
  expect(text.split("\n")).toContain("      K_SPEC_DB: /tmp/k-spec.db");
  expect(text).not.toContain("K_SPEC_AUTO_DUMP");
});

test("with saving off, the server is told and the database stays in the data folder", () => {
  const text = renderCompose({ ...project("My App"), autoDump: false });
  expect(text.split("\n")).toContain('      K_SPEC_AUTO_DUMP: "off"');
  expect(text).not.toContain("K_SPEC_DB");
});

test("the board has a network of its own and leaves the default one alone", () => {
  const text = renderCompose(project("My App"));
  expect(text).toContain("\n    networks:\n      - k-spec\n");
  expect(text.endsWith("\nnetworks:\n  k-spec:\n    name: k-spec-my-app\n")).toBe(true);
  expect(text).not.toContain("default:");
});

test("the project's compose file is looked for under the names Compose uses, in its order", () => {
  expect(PROJECT_COMPOSE_FILES).toEqual(["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]);
});

test("the board is included when the project's compose file lists it under include", () => {
  for (const entry of [
    "- .k-spec/compose.yaml",
    "- ./.k-spec/compose.yaml",
    '- ".k-spec/compose.yaml"   # the board',
    "- path: '.k-spec/compose.yaml'",
    "- project_directory: .\n    path: .k-spec/compose.yaml",
  ]) {
    expect(composeIncludesBoard(`include:\n  - other.yaml\n  ${entry}\nservices:\n  web:\n    image: nginx\n`)).toBe(true);
  }
  expect(composeIncludesBoard("services: {}\ninclude: # ours\r\n  - .k-spec/compose.yaml\r\n")).toBe(true);
});

test("a list that is not indented under include is read too", () => {
  // Valid YAML, and what many tools write.
  for (const text of [
    "include:\n- .k-spec/compose.yaml\n",
    "include:\n- other.yaml\n- path: .k-spec/compose.yaml\nservices:\n  web:\n    image: nginx\n",
    "include:\n- project_directory: .\n  path: ./.k-spec/compose.yaml\n",
  ]) {
    expect(composeIncludesBoard(text)).toBe(true);
  }
  // A list under another key is still not it.
  expect(composeIncludesBoard("include:\n- other.yaml\nx-files:\n- .k-spec/compose.yaml\n")).toBe(false);
  expect(composeIncludesBoard("x-files:\n- .k-spec/compose.yaml\ninclude:\n- other.yaml\n")).toBe(false);
});

test("naming the file anywhere else is not including it", () => {
  for (const text of [
    "",
    "services:\n  web:\n    image: nginx\n",
    "include:\n  # - .k-spec/compose.yaml\n  - other.yaml\n",
    "include:\n  - other.yaml\nservices:\n  web:\n    env_file:\n      - .k-spec/compose.yaml\n",
    "include:\n  - .k-spec/compose.yaml.bak\n",
    "include:\n  - sub/.k-spec/compose.yaml\n",
    "# include:\n#   - .k-spec/compose.yaml\n",
    "x-include:\n  - .k-spec/compose.yaml\n",
  ]) {
    expect(composeIncludesBoard(text)).toBe(false);
  }
});
