// @vitest-environment node
import fs from "node:fs";
import { INIT_COMMANDS } from "./init/init-command.js";
import { START_INCLUDED, START_SEPARATE } from "./init/launcher.js";

// The Claude Code plugin: a marketplace file at the repository's root that offers the one
// plugin in plugin/, whose skills set a project's board up, start it and stop it. The skills
// are text an agent follows, so what they name must exist: these tests hold them to that.
const read = (file) => fs.readFileSync(file, "utf8");
const json = (file) => JSON.parse(read(file));
const SKILLS = ["setup", "stop", "use"];
const skill = (name) => read(`plugin/skills/${name}/SKILL.md`);
const frontmatter = (text) => (text.match(/^---\n([\s\S]*?)\n---\n/) ?? [])[1] ?? "";
const field = (text, name) => (frontmatter(text).match(new RegExp(`^${name}: (.*)$`, "m")) ?? [])[1];
// The text is wrapped: a phrase may run over a line end.
const flat = (text) => text.replace(/\s+/g, " ");
/** Everything written as code: the code spans, and the lines of the code blocks. */
function code(text) {
  const blocks = [...text.matchAll(/^ *```[a-z]*\n([\s\S]*?)^ *```/gm)].flatMap((match) => match[1].split("\n"));
  const outside = text.replace(/^ *```[a-z]*\n[\s\S]*?^ *```/gm, "");
  return [...blocks, ...[...outside.matchAll(/`([^`\n]+)`/g)].map((match) => match[1])];
}

test("the marketplace offers one plugin, from the plugin folder", () => {
  const marketplace = json(".claude-plugin/marketplace.json");
  expect(marketplace.name).toBe("k-spec");
  expect(marketplace.owner.name).toMatch(/\S/);
  expect(marketplace.plugins).toHaveLength(1);
  expect(marketplace.plugins[0]).toMatchObject({ name: "k-spec", source: "./plugin" });
  expect(marketplace.plugins[0].description).toMatch(/\S.{20,}/);
  expect(fs.existsSync("plugin/.claude-plugin/plugin.json")).toBe(true);
});

test("the plugin is named k-spec and carries the package's version", () => {
  const plugin = json("plugin/.claude-plugin/plugin.json");
  expect(plugin.name).toBe("k-spec");
  expect(plugin.version).toBe(json("package.json").version);
  expect(plugin.repository).toBe("https://github.com/joepreludian/k-spec");
  expect(plugin.description).toMatch(/\S.{20,}/);
  // The repository has no license; the plugin must not claim one.
  expect(Object.hasOwn(plugin, "license")).toBe(false);
});

test("its skills are setup, use and stop, and only use may be loaded by the model", () => {
  expect(fs.readdirSync("plugin/skills").sort()).toEqual(SKILLS);
  for (const name of SKILLS) {
    expect(field(skill(name), "name")).toBe(name);
    expect(field(skill(name), "description")).toMatch(/^Use when \S.{40,}$/);
  }
  for (const name of ["setup", "stop"]) expect(field(skill(name), "disable-model-invocation")).toBe("true");
  expect(field(skill("use"), "disable-model-invocation")).toBeUndefined();
  expect(field(skill("use"), "description")).toContain("using k-spec");
  expect(field(skill("use"), "description")).toMatch(/never on your own initiative/i);
});

test("setup installs the image the release workflow publishes", () => {
  expect(skill("setup")).toContain("docker.io/joepreludian/k-spec:latest");
  expect(read(".github/workflows/release.yml")).toMatch(/^ *IMAGE: docker\.io\/joepreludian\/k-spec$/m);
});

test("every init option a plugin skill names exists", () => {
  const options = Object.keys(INIT_COMMANDS.init.options);
  // In setup, an option written by itself is one to add to the init line.
  const alone = code(skill("setup")).map((written) => /^--([a-z-]+)/.exec(written)?.[1]).filter(Boolean);
  // Anywhere, whatever follows `k-spec init` on a line.
  const inline = SKILLS.flatMap((name) => code(skill(name)))
    .flatMap((written) => written.split("k-spec init")[1]?.match(/--[a-z-]+/g) ?? [])
    .map((option) => option.slice(2));
  expect(alone).toContain("host");
  for (const option of [...alone, ...inline]) expect(options).toContain(option);
});

test("plugin skills run no board command but board and help", () => {
  // A project is pinned to its own image: a command newer than that image would fail there. What
  // an agent does on the board is said by the skill that ships in the image, never here.
  for (const name of SKILLS) {
    const words = code(skill(name)).flatMap((written) => [...written.matchAll(/(?:^|[\s/])k-spec ([a-z][a-z-]*)/g)].map((match) => match[1]));
    for (const word of words) expect(["board", "help", "init"]).toContain(word);
  }
  expect(code(skill("use")).some((written) => written.includes(".k-spec/k-spec board"))).toBe(true);
});

test("use hands the work to the project's skill", () => {
  const heading = "Working a task on the board";
  expect(skill("use")).toContain(heading);
  expect(read("skills/k-spec/SKILL.md")).toContain(`\n## ${heading}\n`);
  for (const written of [".claude/skills/k-spec/SKILL.md", "/k-spec:setup", "git worktree list", ".k-spec/.env", "$ARGUMENTS"]) {
    expect(skill("use")).toContain(written);
  }
  // It never starts a board that was not set up with init (the k-spec repository's own server).
  expect(flat(skill("use"))).toMatch(/never start it/i);
});

test("stop stops the board's service and nothing else", () => {
  const text = skill("stop");
  // The two start commands init knows, each with the stop command that belongs to it.
  for (const written of [START_INCLUDED, START_SEPARATE, "docker compose stop k-spec", "docker compose -f .k-spec/compose.yaml stop"]) {
    expect(code(text)).toContain(written);
  }
  // Nothing written as code takes a compose project down, or stops one without naming the service.
  for (const written of code(text)) {
    expect(written).not.toMatch(/\bdown\b/);
    if (/docker compose\b.*\bstop\b/.test(written) && !written.includes("-f .k-spec/compose.yaml")) expect(written).toMatch(/stop k-spec$/);
  }
  expect(text).toContain("k-spec.dump.json");
  expect(flat(text)).toMatch(/commit nothing unless the user asks/i);
});

test("setup explains before it writes, refuses a worktree, and checks the compose file it edits", () => {
  const text = skill("setup");
  for (const written of [
    "14201",
    "14299",
    ".k-spec/.env",
    "git rev-parse --git-common-dir",
    "docker compose config --quiet",
    "docker compose version",
    "$ARGUMENTS",
    "- .k-spec/compose.yaml",
    '-u "$(id -u):$(id -g)"',
    "--network host",
  ]) {
    expect(text).toContain(written);
  }
  expect(flat(text)).toMatch(/wait for a yes/i);
  expect(flat(text)).toMatch(/commit nothing unless the user asks/i);
});
