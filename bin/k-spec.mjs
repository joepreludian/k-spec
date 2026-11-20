#!/usr/bin/env node
// The k-spec command: gives the CLI (src/cli/main.js) the real world and exits with its code.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { text } from "node:stream/consumers";
import { setTimeout as wait } from "node:timers/promises";
// The source imports through the `@/` alias; register it before loading anything that does.
import "../scripts/register-alias.mjs";

const { runCli } = await import("../src/cli/main.js");

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

// A command that waits (`watch`) stops when the process is told to: the signal ends its sleep
// and any request under way, and the command returns instead of being cut off mid-line.
const stopping = new AbortController();
for (const name of ["SIGINT", "SIGTERM"]) process.once(name, () => stopping.abort());

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
  });
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
}
