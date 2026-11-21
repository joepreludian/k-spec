// @vitest-environment node
import fs from "node:fs";
import { frontMatter } from "@/test/front-matter.js";
import { renderProjectSkill } from "./init/project-files.js";
import { COMMAND_HANDLERS } from "./main.js";

// The skill is a product file: it is written in skills/k-spec and shipped from there.
const FILE = "skills/k-spec/SKILL.md";
// Sessions in this repository load it through a link, so there is one copy to keep right.
const LOADED_HERE = ".claude/skills/k-spec";

test("the skill exists, is named, and only uses commands the CLI has", () => {
  const text = fs.readFileSync(FILE, "utf8");
  const [, frontmatter] = text.match(/^---\n([\s\S]*?)\n---\n/) ?? [];
  expect(frontmatter).toMatch(/^name: k-spec$/m);
  expect(frontmatter).toMatch(/^description: \S.{40,}$/m);

  // Every `k-spec <word> …` written as code must be something the CLI accepts: in a code span,
  // or at the start of a line in a code block.
  const blocks = [...text.matchAll(/^ *```[a-z]*\n([\s\S]*?)^ *```/gm)].map((match) => match[1]).join("\n");
  const used = [...text.matchAll(/`k-spec ([a-z-]+)[^`]*`/g), ...blocks.matchAll(/^ *k-spec ([a-z-]+)/gm)].map((match) => match[1]);
  expect(used.length).toBeGreaterThan(5);
  for (const name of used) expect(Object.keys(COMMAND_HANDLERS).concat("help")).toContain(name);
  for (const name of ["watch", "show", "status", "comment", "link"]) expect(used).toContain(name);

  // Options it shows must exist on the command they are shown with.
  for (const [, name, rest] of text.matchAll(/`k-spec ([a-z-]+)([^`]*)`/g)) {
    for (const [, option] of rest.matchAll(/--([a-z-]+)/g)) {
      expect(Object.keys({ ...COMMAND_HANDLERS[name]?.options, json: {} })).toContain(option);
    }
  }
  expect(text).toContain("Monitor");
  expect(text).toContain("k-spec.dump.json");
});

test("the skill's reply cannot be mangled by the shell, and says why --agent matters", () => {
  const text = fs.readFileSync(FILE, "utf8");
  // The reply goes through stdin with a quoted heredoc: backticks or $ in a double-quoted
  // argument would be run by the shell.
  expect(text).toContain("k-spec comment <n> - --agent Claude <<'EOF'");
  expect(text).not.toMatch(/k-spec comment <n> "/);
  expect(text).toMatch(/without `--agent`[^.]*stays open/i);
  expect(text).toContain("K_SPEC_AGENT");
});

test("the skill covers what a session meets when watching goes wrong", () => {
  const text = fs.readFileSync(FILE, "utf8");
  for (const phrase of ["token rejected", "ended by itself", "more than one line", "npx k-spec", "project folder"]) {
    expect(text).toContain(phrase);
  }
});

test("this repository's own sessions load the shipped skill, not a second copy", () => {
  expect(fs.lstatSync(LOADED_HERE).isSymbolicLink()).toBe(true);
  // A relative link: it must still point at the skill after the repository is cloned elsewhere.
  expect(fs.readlinkSync(LOADED_HERE)).toBe("../../skills/k-spec");
  expect(fs.realpathSync(`${LOADED_HERE}/SKILL.md`)).toBe(fs.realpathSync(FILE));
});

test("the skill covers a project set up by k-spec init", () => {
  const text = fs.readFileSync(FILE, "utf8");
  for (const phrase of [".k-spec/k-spec", "`k-spec init`", ".k-spec/data/k-spec.dump.json", "this project's board is not running"]) {
    expect(text).toContain(phrase);
  }
  // There too, the board is not the agent's to start or stop.
  expect(text).toMatch(/do not try to start, restart or stop/);
});

test("the copy init writes into a project names the launcher and changes nothing else", () => {
  const source = fs.readFileSync(FILE, "utf8");
  const copy = renderProjectSkill(source);
  const [frontmatter] = source.match(/^---\n[\s\S]*?\n---\n/);
  const rest = source.slice(frontmatter.length);
  expect(copy.startsWith(frontmatter)).toBe(true);
  expect(copy.endsWith(rest)).toBe(true);
  const added = copy.slice(frontmatter.length, copy.length - rest.length);
  expect(added).toContain("`.k-spec/k-spec watch`");
  // The note names no command the CLI lacks: the same guard as for the skill itself.
  for (const [, name] of added.matchAll(/`k-spec ([a-z-]+)[^`]*`/g)) expect(Object.keys(COMMAND_HANDLERS)).toContain(name);
});

test("the skill says how to work a task on the board, and only when asked", () => {
  const text = fs.readFileSync(FILE, "utf8");
  const [, frontmatter] = text.match(/^---\n([\s\S]*?)\n---\n/);
  expect(frontmatter).toMatch(/^description: .*using k-spec/m);
  // The plugin's `use` skill sends the agent to this heading: it must not be renamed.
  const at = text.indexOf("\n## Working a task on the board\n");
  expect(at).toBeGreaterThan(0);
  const section = text.slice(at, text.indexOf("\n## ", at + 1));
  for (const written of [
    'k-spec add Backlog "<title>" --description -',
    "Card: k-spec #<n>",
    'k-spec link <n> <path> "Design"',
    "k-spec checklist <n> Plan - <<'EOF'",
    "k-spec status <n> working",
    'k-spec move <n> "In Progress"',
    "k-spec start <n>",
    "k-spec check <n> Plan.<N>",
    "k-spec move <n> Done",
    "k-spec status <n> idle",
    "k-spec end <n>",
    'k-spec board --lane "In Progress"',
    "/k-spec:use",
  ]) {
    expect(section).toContain(written);
  }
  // The text is wrapped: a phrase may run over a line end.
  const prose = section.replace(/\s+/g, " ");
  for (const phrase of [/only after the user asked/i, /offer once/i, /never blocks the build/i, /never create or rename a lane/i, /stage files by name/i]) {
    expect(prose).toMatch(phrase);
  }
  // The card's number is written as plain text, not as a code span the guard above reads as a command.
  expect(section).not.toMatch(/`k-spec card/);
});

test("the older rules agree with the workflow", () => {
  const text = fs.readFileSync(FILE, "utf8");
  expect(text.replace(/\s+/g, " ")).toMatch(/move it to another lane unless the user asked/);
  expect(text).toMatch(/do not try to start, restart or stop/);
  for (const skill of ["/k-spec:use", "/k-spec:stop"]) expect(text).toContain(skill);
});

test("the description reaches the model whole: YAML does not cut it at a #", () => {
  const text = fs.readFileSync(FILE, "utf8");
  const { description } = frontMatter(text);
  for (const trigger of ['"k-spec #12"', "watch the board", "using k-spec", "track this on the board", "resume on k-spec", '"request #"', "new piece of work"]) {
    expect(description).toContain(trigger);
  }
  // The copy a project gets carries the same description.
  expect(frontMatter(renderProjectSkill(text)).description).toBe(description);
});

const workflow = () => {
  const text = fs.readFileSync(FILE, "utf8");
  const at = text.indexOf("\n## Working a task on the board\n");
  return text.slice(at, text.indexOf("\n## ", at + 1));
};

test("the offer is the one thing done unasked, and it comes before the rule that shuts the rest", () => {
  const prose = workflow().replace(/\s+/g, " ");
  expect(prose).toMatch(/the one thing here you do unasked/i);
  expect(prose.search(/offer once/i)).toBeGreaterThan(0);
  expect(prose.search(/offer once/i)).toBeLessThan(prose.search(/applies only after the user asked/i));
});

test("the steps a plan carries include leaving the board's file out of commits", () => {
  // The block goes into the plan and is all a subagent with one task sees.
  const [, block] = workflow().match(/```\n(\s*Card: k-spec #<n>\.[\s\S]*?)```/) ?? [];
  expect(block).toBeDefined();
  const carried = block.replace(/\s+/g, " ");
  for (const phrase of [/never blocks the build/i, /never stage the board's file/i, /stage files by name/i, /from the root of the checkout/i]) {
    expect(carried).toMatch(phrase);
  }
});

test("resuming covers no card, several cards, and a first step that was already done", () => {
  const prose = workflow().replace(/\s+/g, " ");
  for (const phrase of [/no card there/i, /several cards/i, /already has a `Plan` checklist/i, /do not run it again/i]) {
    expect(prose).toMatch(phrase);
  }
});

test("the card is made once the user has answered, and a document's commit is the project's business", () => {
  const prose = workflow().replace(/\s+/g, " ");
  expect(prose).toMatch(/the user has answered/i);
  expect(prose).toMatch(/whether a document is committed/i);
});
