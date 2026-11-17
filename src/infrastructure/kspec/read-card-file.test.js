// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readCardFile } from "./read-card-file.js";

let root;
const write = async (relative, content) => {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
};
const read = (requested, extra = {}) => readCardFile({ rootDir: root, path: requested, fs, ...extra });

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kspec-files-"));
  await write("lanes/todo/3_watcher/card.yaml", "title: W\n");
  await write("lanes/todo/3_watcher/files/design.md", "# design");
  await write("lanes/todo/3_watcher/files/My Spec.md", "# spaced");
  await write("lanes/todo/3_watcher/secret.md", "# not in files");
  await write("lanes/todo/33_other/files/design.md", "# other card");
  await write("outside.md", "# outside");
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

test("200 with the requested path and the file's content", async () => {
  expect(await read("kspec-cards/3/design.md")).toEqual({
    status: 200,
    body: { path: "kspec-cards/3/design.md", content: "# design" },
  });
});

test("finds the card by its exact number, not by prefix", async () => {
  expect((await read("kspec-cards/33/design.md")).body.content).toBe("# other card");
});

test("decodes percent-encoding once", async () => {
  const result = await read("kspec-cards/3/My%20Spec.md");
  expect(result.status).toBe(200);
  expect(result.body.path).toBe("kspec-cards/3/My Spec.md");
});

test("still found after the card folder moves to another lane", async () => {
  await fs.mkdir(path.join(root, "lanes/done"), { recursive: true });
  await fs.rename(path.join(root, "lanes/todo/3_watcher"), path.join(root, "lanes/done/3_renamed"));
  expect((await read("kspec-cards/3/design.md")).status).toBe(200);
});

test.each([
  "kspec-cards/3/../secret.md",
  "kspec-cards/3/..%2Fsecret.md",
  "kspec-cards/3/%2e%2e/%2e%2e/%2e%2e/%2e%2e/outside.md",
  "kspec-cards/3/sub/design.md",
  "kspec-cards/3",
  "kspec-cards/x/design.md",
  "kspec-cards/03/design.md",
  "kspec-cards/3/design.txt",
  "kspec-cards/3/a%5Cb.md",
  "other/3/design.md",
])("rejects %s with 400", async (requested) => {
  expect(await read(requested)).toEqual({ status: 400, body: { error: "Invalid path" } });
});

test("404 for an unknown card, a missing file, or a missing root", async () => {
  expect((await read("kspec-cards/99/design.md")).status).toBe(404);
  expect((await read("kspec-cards/3/nope.md")).status).toBe(404);
  expect((await readCardFile({ rootDir: path.join(root, "nope"), path: "kspec-cards/3/design.md", fs })).status).toBe(404);
});

test("413 when the file is too large", async () => {
  expect((await read("kspec-cards/3/design.md", { maxBytes: 2 })).status).toBe(413);
});
