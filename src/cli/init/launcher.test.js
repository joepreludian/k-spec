// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderLauncher, START_INCLUDED, START_SEPARATE } from "./launcher.js";

// The launcher is run for real, against stand-ins for `docker` and `git` that write down how
// they were called (one file per docker subcommand, every argument followed by a NUL byte).
const FAKE_DOCKER = `#!/bin/sh
case "$1" in
  container) log="$FAKE_DIR/inspect.args" ;;
  *) log="$FAKE_DIR/$1.args" ;;
esac
for arg in "$@"; do printf '%s\\0' "$arg"; done > "$log"
case "$1" in
  container)
    [ "\${FAKE_LABEL+set}" = set ] || { echo "Error response from daemon: No such container: $5" >&2; exit 1; }
    printf '%s\\n' "$FAKE_LABEL"
    ;;
  run) exit "\${FAKE_RUN_EXIT:-0}" ;;
esac
`;
const FAKE_GIT = `#!/bin/sh
[ "\${FAKE_BRANCH+set}" = set ] || exit 128
printf '%s\\n' "$FAKE_BRANCH"
`;

const PROJECT = { image: "k-spec:dev", slug: "my-app", projectId: "abc123" };
const START = "docker compose -f .k-spec/compose.yaml up -d";

let dir;
let launcher;
let bin;
let work;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kspec-launcher-"));
  launcher = path.join(dir, "k-spec");
  fs.writeFileSync(launcher, renderLauncher(PROJECT), { mode: 0o755 });
  bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "docker"), FAKE_DOCKER, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "git"), FAKE_GIT, { mode: 0o755 });
  work = path.join(dir, "some where");
  fs.mkdirSync(work);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Runs the launcher. `env` is all it gets besides PATH; FAKE_LABEL is the board's label, absent meaning "no such container". */
function launch(args, env = {}, { cwd = work, PATH = `${bin}:${process.env.PATH}` } = {}) {
  const result = spawnSync(launcher, args, { cwd, env: { PATH, FAKE_DIR: dir, ...env }, encoding: "utf8" });
  const call = (name) => {
    const file = path.join(dir, `${name}.args`);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\0").slice(0, -1) : null;
  };
  return { code: result.status, out: result.stdout, err: result.stderr, inspect: call("inspect"), run: call("run") };
}

const MINE = { FAKE_LABEL: "abc123", FAKE_BRANCH: "feat/x" };
// Asked of the process, not of the user database: the launcher uses `id`, which answers for a
// user that has no entry there (the usual case inside a container).
const uid = process.getuid();
const gid = process.getgid();
const runCall = (...words) => [
  "run", "--rm", "--init", "-i",
  // The image's health check asks for the server's /access page: in a container that only runs
  // the command it would fail for as long as a watch lives, and start a process every second.
  "--no-healthcheck",
  "--network", "k-spec-my-app",
  "--volumes-from", "k-spec-my-app:ro",
  "--user", `${uid}:${gid}`,
  "--label", "k-spec.project=abc123",
  "--label", "k-spec.role=cli",
  "-e", "K_SPEC_AGENT",
  "-e", "K_SPEC_BRANCH=feat/x",
  "-e", `K_SPEC_HOSTNAME=${os.hostname()}`,
  "-e", `K_SPEC_START_HINT=${START}`,
  "k-spec:dev", "k-spec", ...words,
];

test("it runs the command in a container of the pinned image, next to the board", () => {
  const result = launch(["show", "3", "--activity"], MINE);
  expect([result.code, result.err, result.out]).toEqual([0, "", ""]);
  expect(result.inspect).toEqual(["container", "inspect", "--format", '{{ index .Config.Labels "k-spec.project" }}', "k-spec-my-app"]);
  expect(result.run).toEqual(runCall("show", "3", "--activity"));
});

test("no board container: one line saying how to start it, exit 3, nothing run", () => {
  const result = launch(["board"]);
  expect([result.code, result.out]).toEqual([3, ""]);
  expect(result.err).toBe(`error: this project's board is not running (start it with: ${START})\n`);
  expect(result.run).toBeNull();
});

test("a board of another project under the same name is not this one's: exit 3, nothing run", () => {
  for (const label of ["someone-elses", ""]) {
    const result = launch(["board"], { FAKE_LABEL: label });
    expect([result.code, result.out]).toEqual([3, ""]);
    expect(result.err).toBe(
      "error: the board running as k-spec-my-app belongs to another project (run k-spec init again with --name <another name>)\n",
    );
    expect(result.run).toBeNull();
  }
});

test("arguments reach the command exactly as given, and nothing in them is run", () => {
  const words = ["comment", "4", "a b", `it's "q"`, "$(touch pwned) `touch pwned2` $HOME", "line1\nline2", "", "-", "--", "-x"];
  const result = launch(words, MINE);
  expect(result.code).toBe(0);
  expect(result.run).toEqual(runCall(...words));
  expect(fs.readdirSync(work)).toEqual([]);
});

test("the caller's server address and token never reach the container", () => {
  const result = launch(["board"], { ...MINE, K_SPEC_URL: "http://elsewhere:1", K_SPEC_TOKEN: "leak", K_SPEC_SERVER_FILE: "/x" });
  expect(result.run).toEqual(runCall("board"));
  expect(result.run.join(" ")).not.toMatch(/K_SPEC_URL|K_SPEC_TOKEN|K_SPEC_SERVER_FILE|leak|elsewhere/);
});

test("the agent's name is passed by name, so docker takes it from the caller", () => {
  const result = launch(["comment", "4", "done"], { ...MINE, K_SPEC_AGENT: "Claude" });
  const at = result.run.indexOf("K_SPEC_AGENT");
  expect(result.run[at - 1]).toBe("-e");
});

test("outside a git repository, or on a detached head, the branch is passed empty", () => {
  for (const env of [{ FAKE_LABEL: "abc123" }, { FAKE_LABEL: "abc123", FAKE_BRANCH: "HEAD" }]) {
    const result = launch(["start", "3"], env);
    expect(result.code).toBe(0);
    expect(result.run).toContain("K_SPEC_BRANCH=");
  }
});

test("the command's exit code is the launcher's", () => {
  expect(launch(["show", "99"], { ...MINE, FAKE_RUN_EXIT: "1" }).code).toBe(1);
  expect(launch(["nope"], { ...MINE, FAKE_RUN_EXIT: "2" }).code).toBe(2);
});

test("it does not depend on the directory it is called from", () => {
  const elsewhere = launch(["board"], MINE, { cwd: os.tmpdir() });
  expect(elsewhere.run).toEqual(runCall("board"));
});

test("without docker it says so", () => {
  const only = path.join(dir, "only");
  fs.mkdirSync(only);
  for (const tool of ["sh", "id", "uname"]) {
    const real = process.env.PATH.split(":").map((p) => path.join(p, tool)).find((p) => fs.existsSync(p));
    fs.symlinkSync(real, path.join(only, tool));
  }
  const result = launch(["board"], MINE, { PATH: only });
  expect([result.code, result.err, result.out]).toEqual([3, "error: docker not found\n", ""]);
});

test("the file says where it comes from, is plain sh, and never asks for a terminal", () => {
  const text = renderLauncher(PROJECT);
  const lines = text.split("\n");
  expect(lines[0]).toBe("#!/bin/sh");
  expect(lines[1]).toContain("k-spec init");
  expect(text).toContain("IMAGE='k-spec:dev'");
  expect(text).toContain("BOARD='k-spec-my-app'");
  expect(text).toContain("PROJECT='abc123'");
  expect(text).not.toMatch(/\s-t\s|\s-it\s|--tty/);
  expect(text.endsWith("\n")).toBe(true);
  expect(spawnSync("sh", ["-n", launcher]).status).toBe(0);
});

test("a board that is part of the project's compose file is started through it", () => {
  fs.writeFileSync(launcher, renderLauncher({ ...PROJECT, start: START_INCLUDED }), { mode: 0o755 });
  const gone = launch(["board"]);
  expect(gone.code).toBe(3);
  expect(gone.err).toContain("start it with: docker compose up -d k-spec)");
  expect(launch(["board"], MINE).run).toContain("K_SPEC_START_HINT=docker compose up -d k-spec");
});

test("the start command is one of the two init knows", () => {
  expect(START_SEPARATE).toBe(START);
  expect(START_INCLUDED).toBe("docker compose up -d k-spec");
  expect(renderLauncher(PROJECT)).toBe(renderLauncher({ ...PROJECT, start: START_SEPARATE }));
  // It is written into the script between single quotes: nothing else may ever get there.
  expect(() => renderLauncher({ ...PROJECT, start: "rm -rf /" })).toThrow();
  expect(() => renderLauncher({ ...PROJECT, start: "x'; touch INJECTED; : '" })).toThrow();
});
