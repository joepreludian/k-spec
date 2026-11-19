// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { announceServer, removeServerNote, serverNotePath, writeServerNote } from "./server-note.js";

let dir;
let file;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-note-"));
  file = path.join(dir, "data", "k-spec.server.json");
});
afterEach(() => {
  delete globalThis[Symbol.for("k-spec.server-note-hook")];
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the note path is K_SPEC_SERVER_FILE, else data/k-spec.server.json under cwd", () => {
  expect(serverNotePath({ K_SPEC_SERVER_FILE: "/x/n.json" }, "/p")).toBe("/x/n.json");
  expect(serverNotePath({}, "/p")).toBe(path.join("/p", "data", "k-spec.server.json"));
  expect(serverNotePath({ K_SPEC_SERVER_FILE: "" }, "/p")).toBe(path.join("/p", "data", "k-spec.server.json"));
});

test("the note holds url, token and pid and is readable by its owner only", () => {
  writeServerNote({ file, url: "http://localhost:3000", token: "tok", pid: 7 });
  expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ url: "http://localhost:3000", token: "tok", pid: 7 });
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});

test("rewriting a note that was world-readable tightens it", () => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{}", { mode: 0o644 });
  writeServerNote({ file, url: "u", token: "t", pid: 1 });
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});

test("only the process that wrote the note removes it", () => {
  writeServerNote({ file, url: "u", token: "t", pid: 7 });
  expect(removeServerNote({ file, pid: 8 })).toBe(false);
  expect(fs.existsSync(file)).toBe(true);
  expect(removeServerNote({ file, pid: 7 })).toBe(true);
  expect(fs.existsSync(file)).toBe(false);
  expect(removeServerNote({ file, pid: 7 })).toBe(false); // gone already
  fs.writeFileSync(file, "not json");
  expect(removeServerNote({ file, pid: 7 })).toBe(false);
  expect(fs.existsSync(file)).toBe(true);
});

test("announcing writes the note for localhost and removes it on exit, registering once", () => {
  const on = vi.fn();
  const env = { K_SPEC_SERVER_FILE: file, PORT: "3131" };
  const written = announceServer({ env, cwd: dir, token: "tok", pid: 7, on });
  announceServer({ env, cwd: dir, token: "tok", pid: 7, on });
  expect(written).toBe(file);
  expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ url: "http://localhost:3131", token: "tok", pid: 7 });
  expect(on).toHaveBeenCalledTimes(1);
  expect(on.mock.calls[0][0]).toBe("exit");
  on.mock.calls[0][1]();
  expect(fs.existsSync(file)).toBe(false);
});

test("without PORT the note says 3000, and a note that cannot be written does not stop the server", () => {
  announceServer({ env: { K_SPEC_SERVER_FILE: file }, cwd: dir, token: "tok", pid: 7, on: vi.fn() });
  expect(JSON.parse(fs.readFileSync(file, "utf8")).url).toBe("http://localhost:3000");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const blocked = path.join(file, "under-a-file", "note.json"); // its parent is a file
  expect(() => announceServer({ env: { K_SPEC_SERVER_FILE: blocked }, cwd: dir, token: "t", pid: 7, on: vi.fn() })).not.toThrow();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
