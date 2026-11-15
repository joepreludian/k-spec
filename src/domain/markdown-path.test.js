import { assertMarkdownPath } from "./markdown-path.js";
import { InvalidLinkPath } from "./errors.js";

test.each(["README.md", "docs/specs/a.md", "Notes.MARKDOWN"])("accepts %s", (p) => {
  expect(assertMarkdownPath(p)).toBe(p);
});

test("trims surrounding whitespace", () => {
  expect(assertMarkdownPath("  docs/a.md ")).toBe("docs/a.md");
});

test.each(["", "  ", "/abs.md", "../up.md", "docs/../x.md", "./x.md", "a\\b.md", "notes.txt", "dir/", "x.md/", "docs//a.md", 42, null])(
  "rejects %s",
  (p) => {
    expect(() => assertMarkdownPath(p)).toThrow(InvalidLinkPath);
  },
);
