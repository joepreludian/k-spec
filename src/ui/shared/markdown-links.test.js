import { rewriteMarkdownHref } from "./markdown-links.js";

test.each([
  ["./plan.md", "docs/specs/design.md", { href: "/files/docs/specs/plan.md", kind: "internal" }],
  ["plan.md", "docs/specs/design.md", { href: "/files/docs/specs/plan.md", kind: "internal" }],
  ["../README.md", "docs/a.md", { href: "/files/README.md", kind: "internal" }],
  ["docs/specs/x.md", "README.md", { href: "/files/docs/specs/x.md", kind: "internal" }],
  ["Notes.MARKDOWN", "README.md", { href: "/files/Notes.MARKDOWN", kind: "internal" }],
  ["../../x.md", "README.md", { href: "../../x.md", kind: "plain" }],
  ["https://example.com", "README.md", { href: "https://example.com", kind: "external" }],
  ["HTTP://example.com/x", undefined, { href: "HTTP://example.com/x", kind: "external" }],
  ["#intent", "README.md", { href: "#intent", kind: "other" }],
  ["/files/x.md", "README.md", { href: "/files/x.md", kind: "other" }],
  ["image.png", "README.md", { href: "image.png", kind: "other" }],
  ["./plan.md", undefined, { href: "./plan.md", kind: "other" }],
  [undefined, "README.md", { href: "", kind: "other" }],
])("rewriteMarkdownHref(%s, %s)", (href, base, out) => {
  expect(rewriteMarkdownHref(href, base)).toEqual(out);
});
