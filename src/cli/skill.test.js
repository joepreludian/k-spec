// @vitest-environment node
import fs from "node:fs";
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

  // Every `k-spec <word> …` written as code must be something the CLI accepts.
  const used = [...text.matchAll(/`k-spec ([a-z-]+)[^`]*`/g)].map((match) => match[1]);
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
  // The note uses no command or option the CLI lacks: the same guard as for the skill itself.
  expect([...added.matchAll(/`k-spec ([a-z-]+)[^`]*`/g)]).toEqual([]);
});
