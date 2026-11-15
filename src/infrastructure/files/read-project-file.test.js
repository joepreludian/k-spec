// @vitest-environment node
import { readProjectFile } from "./read-project-file.js";

const fakeFs = (files) => ({
  stat: async (p) => {
    if (!(p in files)) throw Object.assign(new Error("nope"), { code: "ENOENT" });
    return { size: files[p] === null ? 0 : Buffer.byteLength(files[p]), isFile: () => files[p] !== null };
  },
  readFile: async (p) => files[p],
});

test("200 with path and content", async () => {
  const res = await readProjectFile({ rootDir: "/proj", path: "README.md", fs: fakeFs({ "/proj/README.md": "# hi" }) });
  expect(res).toEqual({ status: 200, body: { path: "README.md", content: "# hi" } });
});

test("404 when missing or a directory, 413 when too large, 400 when invalid", async () => {
  expect(await readProjectFile({ rootDir: "/proj", path: "x.md", fs: fakeFs({}) })).toEqual({ status: 404, body: { error: "Not found" } });
  expect((await readProjectFile({ rootDir: "/proj", path: "dir.md", fs: fakeFs({ "/proj/dir.md": null }) })).status).toBe(404);
  expect(await readProjectFile({ rootDir: "/proj", path: "x.md", fs: fakeFs({ "/proj/x.md": "ab" }), maxBytes: 1 })).toEqual({ status: 413, body: { error: "Too large" } });
  expect(await readProjectFile({ rootDir: "/proj", path: "../x.md", fs: fakeFs({}) })).toEqual({ status: 400, body: { error: "Invalid path" } });
});

test("defaults maxBytes to 1 MiB", async () => {
  const big = "x".repeat(1024 * 1024 + 1);
  expect((await readProjectFile({ rootDir: "/proj", path: "x.md", fs: fakeFs({ "/proj/x.md": big }) })).status).toBe(413);
});
