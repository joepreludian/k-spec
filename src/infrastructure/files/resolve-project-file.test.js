// @vitest-environment node
import { resolveProjectFile } from "./resolve-project-file.js";

const root = "/proj";

test("resolves a valid relative markdown path inside the root", () => {
  expect(resolveProjectFile(root, "docs/a.md")).toEqual({ ok: true, path: "docs/a.md", absolutePath: "/proj/docs/a.md" });
});

test("decodes percent-encoding once", () => {
  expect(resolveProjectFile(root, "docs/my%20spec.md")).toEqual({ ok: true, path: "docs/my spec.md", absolutePath: "/proj/docs/my spec.md" });
});

test.each(["../a.md", "/etc/x.md", "a.txt", "", "%2e%2e/a.md", "docs/../../a.md", "docs%2F..%2F..%2Fx.md", "%E0%A4%A", "a\\b.md"])(
  "rejects %s with 400",
  (p) => {
    expect(resolveProjectFile(root, p)).toEqual({ ok: false, status: 400 });
  },
);
