#!/usr/bin/env node
// The k-spec command: gives the CLI (src/cli/main.js) the real world and exits with its code.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { text } from "node:stream/consumers";
import { setTimeout as wait } from "node:timers/promises";
// The source imports through the `@/` alias; register it before loading anything that does.
import "../scripts/register-alias.mjs";

const { runCli } = await import("../src/cli/main.js");
const { portIsFree } = await import("../src/infrastructure/port-check.js");

function readFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function gitBranch() {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}

// What `init` needs to set a project up: the folder it writes into and a few facts of the machine.
const local = {
  writeFile(file, text, mode) {
    fs.writeFileSync(file, text, { mode });
    fs.chmodSync(file, mode); // `mode` only applies when the file is created, and then minus the umask
  },
  makeDir: (dir) => fs.mkdirSync(dir, { recursive: true }),
  isSymlink(file) {
    try {
      return fs.lstatSync(file).isSymbolicLink();
    } catch {
      return false;
    }
  },
  fileExists: (file) => fs.existsSync(file),
  user: () => ({ uid: process.getuid(), gid: process.getgid() }),
  randomBytes,
  portIsFree,
  readSkill: () => fs.readFileSync(new URL("../skills/k-spec/SKILL.md", import.meta.url), "utf8"),
};

// A command that waits (`watch`) stops when the process is told to: the signal ends its sleep
// and any request under way, and the command returns instead of being cut off mid-line.
// A command that is not waiting that way (one reading stdin, say) must still die on the first
// signal, so if the process is alive a moment later it exits as the signal would have made it.
const stopping = new AbortController();
for (const [name, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(name, () => {
    stopping.abort();
    setTimeout(() => process.exit(code), 250).unref();
  });
}

try {
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    env: process.env,
    cwd: process.cwd(),
    fetch: (url, options) => globalThis.fetch(url, { ...options, signal: stopping.signal }),
    readFile,
    readStdin: () => text(process.stdin),
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    hostname: os.hostname,
    gitBranch,
    sleep: (ms) => wait(ms, undefined, { signal: stopping.signal }).catch(() => {}),
    signal: stopping.signal,
    local,
  });
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
}
