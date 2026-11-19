#!/usr/bin/env node
// The k-spec command: gives the CLI (src/cli/main.js) the real world and exits with its code.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { text } from "node:stream/consumers";
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

try {
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    env: process.env,
    cwd: process.cwd(),
    fetch: (...args) => globalThis.fetch(...args),
    readFile,
    readStdin: () => text(process.stdin),
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    hostname: os.hostname,
    gitBranch,
  });
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
}
