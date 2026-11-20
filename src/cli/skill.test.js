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
