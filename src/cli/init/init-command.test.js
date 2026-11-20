// @vitest-environment node
import { runCli } from "../main.js";
import { readComposeHeader, readEnv } from "./project-files.js";

const CWD = "/home/u/My App";
const SKILL = "---\nname: k-spec\ndescription: d\n---\n\n# Skill\n";
const KEYS = ["K_SPEC_BOARD_TOKEN", "K_SPEC_BOARD_PORT", "K_SPEC_BOARD_HOST", "K_SPEC_BOARD_UID", "K_SPEC_BOARD_GID", "K_SPEC_BOARD_PROJECT"];

/**
 * A folder in memory and everything `init` needs from the machine. `taken` is the set of ports
 * in use (or a rule), `links` the paths that are symbolic links, `failWrite(file)` says which
 * writes are refused. `run(args, env)` runs `k-spec init …` there; `asked` in its answer is what
 * that run wanted to know about ports.
 */
function folder({ cwd = CWD, uid = 501, gid = 1000, taken = new Set(), links = [], failWrite = () => false, seed = 1, image = "k-spec:dev" } = {}) {
  const files = new Map();
  const dirs = new Set();
  const asked = [];
  let requests = 0;
  let state = seed;
  const local = {
    writeFile(file, text, mode) {
      if (failWrite(file)) throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      files.set(file, { text, mode });
    },
    makeDir: (dir) => dirs.add(dir),
    isSymlink: (file) => links.includes(file),
    user: () => ({ uid, gid }),
    randomBytes: (n) =>
      Uint8Array.from({ length: n }, () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return (state >> 16) & 0xff;
      }),
    portIsFree: async (port) => (asked.push(port), !(typeof taken === "function" ? taken(port) : taken.has(port))),
    readSkill: () => SKILL,
  };
  async function run(args = [], env = {}) {
    const out = [];
    const err = [];
    asked.length = 0;
    const code = await runCli({
      argv: ["init", ...args],
      env: { ...(image === null ? {} : { K_SPEC_IMAGE: image }), ...env },
      cwd,
      fetch: () => {
        requests += 1;
        throw new Error("init must not reach a server");
      },
      readFile: (file) => files.get(file)?.text ?? null,
      readStdin: async () => "",
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      hostname: () => "box",
      gitBranch: () => null,
      sleep: async () => {},
      signal: new AbortController().signal,
      local,
    });
    return { code, out: out.join("\n"), err: err.join("\n"), asked: [...asked] };
  }
  const at = (rel) => `${cwd}/${rel}`;
  return {
    files,
    dirs,
    run,
    requests: () => requests,
    text: (rel) => files.get(at(rel))?.text,
    mode: (rel) => files.get(at(rel))?.mode,
    env: () => readEnv(files.get(at(".k-spec/.env")).text),
    project: () => readComposeHeader(files.get(at(".k-spec/compose.yaml")).text),
    put: (rel, text, mode = 0o644) => files.set(at(rel), { text, mode }),
  };
}

test("a fresh folder gets the board's files, its own settings, and the next steps", async () => {
  const f = folder();
  const result = await f.run();
  expect([result.code, result.err]).toEqual([0, ""]);

  expect([...f.files.keys()].sort()).toEqual(
    [".claude/skills/k-spec/SKILL.md", ".k-spec/.env", ".k-spec/.gitignore", ".k-spec/compose.yaml", ".k-spec/k-spec"].map((rel) => `${CWD}/${rel}`).sort(),
  );
  expect([f.mode(".k-spec/compose.yaml"), f.mode(".k-spec/k-spec"), f.mode(".k-spec/.gitignore"), f.mode(".k-spec/.env"), f.mode(".claude/skills/k-spec/SKILL.md")]).toEqual([
    0o644, 0o755, 0o644, 0o600, 0o644,
  ]);
  expect(f.dirs.has(`${CWD}/.k-spec/data`)).toBe(true);

  const project = f.project();
  expect(project).toMatchObject({ name: "My App", slug: "my-app" });
  expect(project.id).toMatch(/^[0-9a-f]{16}$/);
  expect(f.text(".k-spec/compose.yaml")).toContain("    image: k-spec:dev\n");
  expect(f.text(".k-spec/k-spec")).toContain("IMAGE='k-spec:dev'\nBOARD='k-spec-my-app'\n");
  expect(f.text(".k-spec/k-spec")).toContain(`PROJECT='${project.id}'`);
  expect(f.text(".claude/skills/k-spec/SKILL.md")).toContain("`.k-spec/k-spec watch`");

  const env = f.env();
  expect(Object.keys(env)).toEqual(KEYS);
  expect(Number(env.K_SPEC_BOARD_PORT)).toBeGreaterThanOrEqual(14201);
  expect(Number(env.K_SPEC_BOARD_PORT)).toBeLessThanOrEqual(14299);
  expect(result.asked).toEqual([Number(env.K_SPEC_BOARD_PORT)]);
  expect(env).toMatchObject({ K_SPEC_BOARD_HOST: "localhost", K_SPEC_BOARD_UID: "501", K_SPEC_BOARD_GID: "1000" });
  expect(env.K_SPEC_BOARD_TOKEN).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(env.K_SPEC_BOARD_PROJECT).toMatch(/^k-spec-my-app-[0-9a-f]{6}$/);

  expect(result.out).toContain(`k-spec is set up for "My App" (board k-spec-my-app, port ${env.K_SPEC_BOARD_PORT}).`);
  expect(result.out).toContain("docker compose -f .k-spec/compose.yaml up -d --wait");
  expect(result.out).toContain("docker compose -f .k-spec/compose.yaml logs k-spec");
  expect(result.out).toContain(".k-spec/compose.yaml .k-spec/k-spec .k-spec/.gitignore .claude/skills/k-spec/SKILL.md");
  expect(result.out).not.toContain(env.K_SPEC_BOARD_TOKEN);
  expect(f.requests()).toBe(0);
});

test("two set-ups do not share a token, an id or a compose project", async () => {
  const a = folder({ seed: 1 });
  const b = folder({ seed: 2 });
  await a.run();
  await b.run();
  expect(a.env().K_SPEC_BOARD_TOKEN).not.toBe(b.env().K_SPEC_BOARD_TOKEN);
  expect(a.project().id).not.toBe(b.project().id);
  expect(a.env().K_SPEC_BOARD_PROJECT).not.toBe(b.env().K_SPEC_BOARD_PROJECT);
});

test("running it again from a newer image changes the image and nothing of the person's", async () => {
  const f = folder();
  await f.run();
  const before = { env: f.text(".k-spec/.env"), project: f.project() };
  const again = await f.run([], { K_SPEC_IMAGE: "k-spec:next" });
  expect([again.code, again.err]).toEqual([0, ""]);
  expect(f.text(".k-spec/.env")).toBe(before.env);
  expect(f.mode(".k-spec/.env")).toBe(0o600);
  expect(f.project()).toEqual(before.project);
  expect(f.text(".k-spec/compose.yaml")).toContain("    image: k-spec:next\n");
  expect(f.text(".k-spec/k-spec")).toContain("IMAGE='k-spec:next'");
  // Its own board is what holds the port now: asking would always say "taken".
  expect(again.asked).toEqual([]);
});

test("--port is used when it is free", async () => {
  const f = folder();
  const result = await f.run(["--port", "15000"]);
  expect(result.code).toBe(0);
  expect(f.env().K_SPEC_BOARD_PORT).toBe("15000");
  expect(result.asked).toEqual([15000]);
});

test("--port on a port that is in use is refused, and nothing is written", async () => {
  const f = folder({ taken: new Set([15000]) });
  const result = await f.run(["--port", "15000"]);
  expect([result.code, result.out]).toEqual([1, ""]);
  expect(result.err).toBe("error: port 15000 is in use on this machine (pass another --port, or none to let init choose)");
  expect([f.files.size, f.dirs.size]).toEqual([0, 0]);
});

test("ports in use are skipped when init chooses", async () => {
  let questions = 0;
  const f = folder({ taken: () => (questions += 1) <= 5 });
  const result = await f.run();
  expect(result.code).toBe(0);
  expect(result.asked).toHaveLength(6);
  expect(f.env().K_SPEC_BOARD_PORT).toBe(String(result.asked[5]));
});

test("no free port in the range is refused, and nothing is written", async () => {
  const f = folder({ taken: () => true });
  const result = await f.run();
  expect([result.code, result.out]).toEqual([1, ""]);
  expect(result.err).toBe("error: no free port between 14201 and 14299 (pass --port <n>)");
  expect(result.asked).toHaveLength(99);
  expect([f.files.size, f.dirs.size]).toEqual([0, 0]);
});

test("a later --port is checked and replaces the port; the token stays", async () => {
  const f = folder();
  await f.run();
  const { K_SPEC_BOARD_TOKEN: token, K_SPEC_BOARD_PORT: first } = f.env();
  const moved = await f.run(["--port", "15001"]);
  expect([moved.code, moved.asked]).toEqual([0, [15001]]);
  expect(f.env()).toMatchObject({ K_SPEC_BOARD_PORT: "15001", K_SPEC_BOARD_TOKEN: token });
  expect(first).not.toBe("15001");
  // Naming the port it already has is not a move: its own board holds it.
  const same = await f.run(["--port", "15001"]);
  expect([same.code, same.asked]).toEqual([0, []]);
  // A taken port leaves the settings as they were.
  const g = folder({ taken: new Set([15002]) });
  await g.run();
  const kept = g.text(".k-spec/.env");
  expect((await g.run(["--port", "15002"])).code).toBe(1);
  expect(g.text(".k-spec/.env")).toBe(kept);
});

test("--host is stored and kept by later runs", async () => {
  const f = folder();
  await f.run(["--host", "box.local"]);
  expect(f.env().K_SPEC_BOARD_HOST).toBe("box.local");
  await f.run();
  expect(f.env().K_SPEC_BOARD_HOST).toBe("box.local");
  await f.run(["--host", "lima-dev.local"]);
  expect(f.env().K_SPEC_BOARD_HOST).toBe("lima-dev.local");
});

test("--name on a later run renames the board and says how to remove the old one", async () => {
  const f = folder();
  await f.run();
  const before = { id: f.project().id, env: f.text(".k-spec/.env") };
  const renamed = await f.run(["--name", "Other Name"]);
  expect(renamed.code).toBe(0);
  expect(f.project()).toEqual({ id: before.id, name: "Other Name", slug: "other-name" });
  expect(f.text(".k-spec/compose.yaml")).toContain("container_name: k-spec-other-name\n");
  expect(f.text(".k-spec/k-spec")).toContain("BOARD='k-spec-other-name'");
  expect(f.text(".k-spec/.env")).toBe(before.env);
  expect(renamed.out).toContain("docker rm -f k-spec-my-app");
  // Giving the name it already has is not a rename.
  const same = await f.run(["--name", "Other Name"]);
  expect(same.out).not.toContain("docker rm -f");
  expect(f.project().slug).toBe("other-name");
});

test("as root it refuses: the files would belong to root", async () => {
  const f = folder({ uid: 0, gid: 0 });
  const result = await f.run();
  expect([result.code, result.out]).toEqual([2, ""]);
  expect(result.err).toBe('error: init must not run as root: add -u "$(id -u):$(id -g)" to the docker run command');
  expect(f.files.size).toBe(0);
});

test("it needs to know the image it runs from", async () => {
  const none = await folder({ image: null }).run();
  expect(none.code).toBe(2);
  expect(none.err).toBe("error: K_SPEC_IMAGE is not set: init runs from the k-spec image (for a local build: K_SPEC_IMAGE=k-spec:dev)");
  expect((await folder({ image: "  " }).run()).code).toBe(2);
  for (const image of ["k-spec:dev'; rm -rf /", "a b", "$(id)", "-rf", "x\ny"]) {
    const f = folder({ image });
    const result = await f.run();
    expect([result.code, result.err]).toEqual([2, "error: K_SPEC_IMAGE is not an image name"]);
    expect(f.files.size).toBe(0);
  }
  const full = folder({ image: "docker.io/joepreludian/k-spec:0.1.0" });
  expect((await full.run()).code).toBe(0);
  expect(full.text(".k-spec/compose.yaml")).toContain("    image: docker.io/joepreludian/k-spec:0.1.0\n");
});

test("a linked skill folder is left alone, and init says so", async () => {
  const f = folder({ links: [`${CWD}/.claude/skills/k-spec`] });
  const result = await f.run();
  expect(result.code).toBe(0);
  expect(f.files.has(`${CWD}/.claude/skills/k-spec/SKILL.md`)).toBe(false);
  expect(f.dirs.has(`${CWD}/.claude/skills/k-spec`)).toBe(false);
  expect(result.out).toContain("Skill not written: .claude/skills/k-spec is a link.");
  expect(result.out).not.toContain("SKILL.md");
  expect(f.files.has(`${CWD}/.k-spec/compose.yaml`)).toBe(true);
});

test.each([
  [["--port", "abc"], "error: --port must be a number from 1 to 65535"],
  [["--port", "0"], "error: --port must be a number from 1 to 65535"],
  [["--port", "70000"], "error: --port must be a number from 1 to 65535"],
  [["--port", "1.5"], "error: --port must be a number from 1 to 65535"],
  [["--port=-5"], "error: --port must be a number from 1 to 65535"],
  [["--port", ""], "error: --port must be a number from 1 to 65535"],
  [["--name", ""], "error: a project name must be one line of 1 to 80 characters (pass --name)"],
  [["--name", "   "], "error: a project name must be one line of 1 to 80 characters (pass --name)"],
  [["--name", "a\nb"], "error: a project name must be one line of 1 to 80 characters (pass --name)"],
  [["--name", "x".repeat(81)], "error: a project name must be one line of 1 to 80 characters (pass --name)"],
  [["--host", "a b"], "error: --host must be a host name"],
  [["--host", "h/x"], "error: --host must be a host name"],
  [["--host", "$(id)"], "error: --host must be a host name"],
  [["extra"], "error: usage: k-spec init [--name <name>] [--port <n>] [--host <name>]"],
])("%j is a usage error", async (args, message) => {
  const f = folder();
  const result = await f.run(args);
  expect([result.code, result.err, result.out]).toEqual([2, message, ""]);
  expect(f.files.size).toBe(0);
});

test("a value that looks like an option is refused by the option parser, still as one usage line", async () => {
  const f = folder();
  const result = await f.run(["--port", "-5"]);
  expect([result.code, result.out]).toEqual([2, ""]);
  expect(result.err).toMatch(/^error: .*--port/);
  expect(result.err.split("\n")).toHaveLength(1);
  expect(f.files.size).toBe(0);
});

test("a folder without a usable name needs --name", async () => {
  const root = folder({ cwd: "/" });
  expect((await root.run()).err).toBe("error: a project name must be one line of 1 to 80 characters (pass --name)");
  expect((await root.run(["--name", "Top"])).code).toBe(0);
});

test("a file that cannot be written is reported with its path, exit 1", async () => {
  const f = folder({ failWrite: (file) => file.endsWith("compose.yaml") });
  const result = await f.run();
  expect([result.code, result.err]).toEqual([1, `error: cannot write ${CWD}/.k-spec/compose.yaml: EACCES`]);
});

test("a clone that has the project's files from git but no settings gets its own, and keeps the project", async () => {
  const origin = folder({ cwd: "/origin/Team App", seed: 5 });
  await origin.run();
  const f = folder({ cwd: "/home/u/checkout-2", seed: 9 });
  f.put(".k-spec/compose.yaml", origin.text(".k-spec/compose.yaml"));
  f.put(".k-spec/k-spec", origin.text(".k-spec/k-spec"), 0o755);
  const result = await f.run();
  expect(result.code).toBe(0);
  // The project is the one in git, not the folder's name.
  expect(f.project()).toEqual(origin.project());
  expect(f.text(".k-spec/k-spec")).toBe(origin.text(".k-spec/k-spec"));
  expect(Object.keys(f.env())).toEqual(KEYS);
  expect(f.env().K_SPEC_BOARD_TOKEN).not.toBe(origin.env().K_SPEC_BOARD_TOKEN);
  expect(f.env().K_SPEC_BOARD_PROJECT).not.toBe(origin.env().K_SPEC_BOARD_PROJECT);
});

test.each([`a "q" #x: y`, "cost $5", "it's `mine` $(id)"])("a name with awkward characters is kept, and cannot reach the launcher: %s", async (name) => {
  const f = folder();
  const result = await f.run(["--name", name]);
  expect([result.code, result.err]).toEqual([0, ""]);
  expect(f.project().name).toBe(name);
  const launcher = f.text(".k-spec/k-spec");
  expect(launcher).not.toContain(name);
  expect(launcher.match(/^(IMAGE|BOARD|PROJECT)='[A-Za-z0-9:._-]+'$/gm)).toHaveLength(3);
});

test("a name with nothing a container name can hold still gets a board name of its own", async () => {
  const f = folder();
  await f.run(["--name", "日本語"]);
  const { id, name, slug } = f.project();
  expect(name).toBe("日本語");
  expect(slug).toBe(`p${id.slice(0, 8)}`);
  expect(f.text(".k-spec/compose.yaml")).toContain(`container_name: k-spec-p${id.slice(0, 8)}\n`);
});

test("the person's own lines in the settings file survive every run", async () => {
  const f = folder();
  await f.run();
  const { K_SPEC_BOARD_TOKEN: token, K_SPEC_BOARD_PORT: port, K_SPEC_BOARD_PROJECT: project } = f.env();
  f.put(
    ".k-spec/.env",
    `# mine\nFOO=1\nK_SPEC_BOARD_PROJECT=${project}\nK_SPEC_BOARD_PORT=${port}\nK_SPEC_BOARD_TOKEN=${token}\nK_SPEC_BOARD_UID=501\nK_SPEC_BOARD_GID=1000\n`,
    0o600,
  );
  const result = await f.run(["--host", "box"]);
  expect(result.code).toBe(0);
  expect(f.text(".k-spec/.env")).toBe(
    `# mine\nFOO=1\nK_SPEC_BOARD_PROJECT=${project}\nK_SPEC_BOARD_PORT=${port}\nK_SPEC_BOARD_TOKEN=${token}\nK_SPEC_BOARD_UID=501\nK_SPEC_BOARD_GID=1000\nK_SPEC_BOARD_HOST=box\n`,
  );
  expect(result.asked).toEqual([]);
});

test("a name from the board cannot break the output into lines", async () => {
  const f = folder();
  await f.run();
  // A compose file from git can hold any name; printing it must stay on its line.
  f.put(".k-spec/compose.yaml", f.text(".k-spec/compose.yaml").replace('"name":"My App"', '"name":"My\\nApp\\u001b[2J"'));
  const result = await f.run();
  expect(result.code).toBe(2);
  expect(result.err.split("\n")).toHaveLength(1);
});

test("help lists init", async () => {
  const out = [];
  await runCli({ argv: ["help"], env: {}, cwd: "/", stdout: (line) => out.push(line) });
  expect(out.join("\n")).toContain("  init [--name <name>] [--port <n>] [--host <name>]");
});
