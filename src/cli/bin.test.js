// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bin = path.resolve("bin/k-spec.mjs");
const run = (args, options = {}) =>
  spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    env: { ...process.env, K_SPEC_URL: "", K_SPEC_TOKEN: "", K_SPEC_SERVER_FILE: "" },
    ...options,
  });

test("the real command starts, resolves the @/ alias and prints usage", () => {
  const result = run(["help"]);
  expect([result.status, result.stderr]).toEqual([0, ""]);
  expect(result.stdout.split("\n")[0]).toBe("k-spec <command> [arguments] [options]");
  expect(result.stdout.endsWith("\n")).toBe(true);
});

test("it runs from another directory and reports a missing server with exit 3", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-bin-"));
  const result = run(["board"], { cwd: dir });
  expect(result.status).toBe(3);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/^error: server not running \(no .*k-spec\.server\.json/);
  expect(result.stderr.trimEnd().split("\n")).toHaveLength(1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a server that is not there is reported, not thrown", () => {
  const result = run(["board"], { env: { ...process.env, K_SPEC_URL: "http://127.0.0.1:1", K_SPEC_TOKEN: "t" } });
  expect([result.status, result.stderr]).toEqual([3, "error: server not answering at http://127.0.0.1:1\n"]);
});

test("it is executable and declared in package.json", () => {
  expect(fs.statSync(bin).mode & 0o111).not.toBe(0);
  expect(JSON.parse(fs.readFileSync("package.json", "utf8")).bin).toEqual({ "k-spec": "bin/k-spec.mjs" });
});

test("watch runs until it is told to stop, then ends cleanly", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-watch-"));
  const child = spawn(process.execPath, [bin, "watch"], {
    cwd: dir,
    env: { ...process.env, K_SPEC_URL: "", K_SPEC_TOKEN: "", K_SPEC_SERVER_FILE: "" },
  });
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const firstLine = new Promise((resolve) => {
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("\n")) resolve();
    });
  });
  const ended = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal })));
  await Promise.race([firstLine, ended]);
  expect(stdout).toMatch(/^k-spec: server not running \(no .*k-spec\.server\.json/);
  expect(child.exitCode).toBeNull(); // still watching
  child.kill("SIGTERM");
  expect(await ended).toEqual({ code: 0, signal: null });
  expect(stderr).toBe("");
  expect(stdout.trimEnd().split("\n")).toHaveLength(1);
  fs.rmSync(dir, { recursive: true, force: true });
}, 15000);
