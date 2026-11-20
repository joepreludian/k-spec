// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

/** A port nothing is listening on right now. */
function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

test.skipIf(process.getuid?.() === 0)("init writes a project's files for real: modes, folders, a second run", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-init-"));
  const init = (...args) => run(["init", ...args], { cwd: dir, env: { ...process.env, K_SPEC_URL: "", K_SPEC_TOKEN: "", K_SPEC_IMAGE: "k-spec:test" } });
  const first = init("--port", String(await freePort()));
  expect([first.status, first.stderr]).toEqual([0, ""]);
  const mode = (rel) => fs.statSync(path.join(dir, rel)).mode & 0o777;
  expect([mode(".k-spec/k-spec"), mode(".k-spec/.env"), mode(".k-spec/compose.yaml")]).toEqual([0o755, 0o600, 0o644]);
  expect(fs.statSync(path.join(dir, ".k-spec/data")).isDirectory()).toBe(true);
  expect(fs.readdirSync(path.join(dir, ".k-spec")).sort()).toEqual([".env", ".gitignore", "compose.yaml", "data", "k-spec"]);
  // The skill is the shipped one, with the note that names the launcher.
  const skill = fs.readFileSync(path.join(dir, ".claude/skills/k-spec/SKILL.md"), "utf8");
  expect(skill).toContain("`.k-spec/k-spec watch`");
  expect(skill).toContain("# k-spec: working with the board");
  expect(spawnSync("sh", ["-n", path.join(dir, ".k-spec/k-spec")]).status).toBe(0);

  const settings = fs.readFileSync(path.join(dir, ".k-spec/.env"), "utf8");
  expect(first.stdout).not.toContain(settings.match(/^K_SPEC_BOARD_TOKEN=(.+)$/m)[1]);
  // Loosened by hand, tightened again; nothing else changes.
  fs.chmodSync(path.join(dir, ".k-spec/.env"), 0o644);
  expect(init().status).toBe(0);
  expect(fs.readFileSync(path.join(dir, ".k-spec/.env"), "utf8")).toBe(settings);
  expect(mode(".k-spec/.env")).toBe(0o600);
  fs.rmSync(dir, { recursive: true, force: true });
});

test.skipIf(process.getuid?.() === 0)("init picks a port in the range by itself, and leaves a linked skill folder alone", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-init-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-skill-"));
  fs.mkdirSync(path.join(dir, ".claude/skills"), { recursive: true });
  fs.symlinkSync(target, path.join(dir, ".claude/skills/k-spec"));
  const result = run(["init"], { cwd: dir, env: { ...process.env, K_SPEC_URL: "", K_SPEC_TOKEN: "", K_SPEC_IMAGE: "k-spec:test" } });
  expect([result.status, result.stderr]).toEqual([0, ""]);
  const port = Number(fs.readFileSync(path.join(dir, ".k-spec/.env"), "utf8").match(/^K_SPEC_BOARD_PORT=(\d+)$/m)[1]);
  expect(port).toBeGreaterThanOrEqual(14201);
  expect(port).toBeLessThanOrEqual(14299);
  expect(fs.readdirSync(target)).toEqual([]);
  expect(result.stdout).toContain("Skill not written");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(target, { recursive: true, force: true });
});

test("init run from source without an image name says what is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-init-"));
  const result = run(["init"], { cwd: dir, env: { ...process.env, K_SPEC_URL: "", K_SPEC_TOKEN: "", K_SPEC_IMAGE: "" } });
  expect(result.status).toBe(2);
  expect(result.stderr).toMatch(/^error: K_SPEC_IMAGE is not set/);
  expect(fs.readdirSync(dir)).toEqual([]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a command waiting on stdin still dies on the first signal", async () => {
  // It gets as far as reading the comment from stdin (which never ends here) and waits there.
  const child = spawn(process.execPath, [bin, "comment", "4", "-"], {
    env: { ...process.env, K_SPEC_URL: "http://127.0.0.1:1", K_SPEC_TOKEN: "t", K_SPEC_SERVER_FILE: "" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const ended = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal })));
  await new Promise((resolve) => setTimeout(resolve, 1500)); // started and waiting
  expect(child.exitCode).toBeNull();
  child.kill("SIGTERM");
  const late = new Promise((resolve) => setTimeout(() => resolve("still running"), 3000));
  const result = await Promise.race([ended, late]);
  child.kill("SIGKILL");
  expect(result).toEqual({ code: 143, signal: null });
}, 15000);
