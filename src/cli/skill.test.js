// @vitest-environment node
import fs from "node:fs";
import { COMMAND_HANDLERS } from "./main.js";

const FILE = ".claude/skills/k-spec/SKILL.md";

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
