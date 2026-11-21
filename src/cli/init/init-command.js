import path from "node:path";
import { Refused, UsageError } from "../errors.js";
import { oneLine } from "../render.js";
import { choosePort, PORT_FIRST, PORT_LAST } from "./choose-port.js";
import { renderLauncher } from "./launcher.js";
import {
  ENV_KEYS,
  mergeEnv,
  readComposeHeader,
  readEnv,
  renderCompose,
  renderGitignore,
  renderProjectSkill,
  slugOf,
} from "./project-files.js";

// The image name is written into a shell script and a YAML file: only what an image name can hold.
const IMAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/;
const HOST_NAME = /^[A-Za-z0-9._:[\]-]{1,253}$/;
const PORT_NUMBER = /^[0-9]{1,5}$/;
const NAME_LIMIT = 80;

const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

function imageName(env) {
  const image = (env.K_SPEC_IMAGE ?? "").trim();
  if (!image) throw new UsageError("K_SPEC_IMAGE is not set: init runs from the k-spec image (for a local build: K_SPEC_IMAGE=k-spec:dev)");
  if (!IMAGE_NAME.test(image)) throw new UsageError("K_SPEC_IMAGE is not an image name");
  return image;
}

function projectName(text) {
  const name = text.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > NAME_LIMIT || oneLine(name) !== name) {
    throw new UsageError(`a project name must be one line of 1 to ${NAME_LIMIT} characters (pass --name)`);
  }
  return name;
}

function portNumber(text) {
  const port = PORT_NUMBER.test(text) ? Number(text) : 0;
  if (port < 1 || port > 65535) throw new UsageError("--port must be a number from 1 to 65535");
  return port;
}

function hostName(text) {
  if (!HOST_NAME.test(text)) throw new UsageError("--host must be a host name");
  return text;
}

/**
 * The port for this project's board, as text, or null to keep the stored one. A port the person
 * names is checked unless it is the one the project already has (its own board holds that one);
 * with none named and none stored, a free one is drawn from the default range.
 */
async function boardPort(wanted, stored, { randomBytes, portIsFree }) {
  if (wanted !== undefined) {
    const port = portNumber(wanted);
    if (String(port) === stored) return null;
    if (!(await portIsFree(port))) {
      throw new Refused(`port ${port} is in use on this machine (pass another --port, or none to let init choose)`);
    }
    return String(port);
  }
  if (stored) return null;
  const port = await choosePort({ randomBytes, portIsFree });
  if (port === null) throw new Refused(`no free port between ${PORT_FIRST} and ${PORT_LAST} (pass --port <n>)`);
  return String(port);
}

/**
 * `k-spec init`: sets the current folder up as a k-spec project (the board's compose file, the
 * launcher, this machine's settings, the skill), or brings a project that is set up to the image
 * it runs from. It needs no server. Everything is decided and checked first; only then are files
 * written, so a refusal leaves the folder as it was. What a project already has is kept: its
 * id, name, token, port, host name and whether it saves on every change (`--auto-dump`,
 * `--no-auto-dump`) change only when the person passes the option for them.
 */
async function init({ env, cwd, readFile, local, out }, { values }) {
  const image = imageName(env);
  if (local.user().uid === 0) throw new UsageError('init must not run as root: add -u "$(id -u):$(id -g)" to the docker run command');

  const dir = path.join(cwd, ".k-spec");
  const files = {
    compose: path.join(dir, "compose.yaml"),
    launcher: path.join(dir, "k-spec"),
    gitignore: path.join(dir, ".gitignore"),
    settings: path.join(dir, ".env"),
  };
  const composeText = readFile(files.compose);
  const known = readComposeHeader(composeText ?? "");
  // A compose file that is there but is not recognisably init's is never taken over: it may be
  // the person's own, or a project whose identity would silently be replaced by a new one.
  if (composeText !== null && known === null) {
    throw new Refused(`${files.compose} was not written by k-spec init, or its first line was changed (restore it from git, or move it away)`);
  }
  const settingsText = readFile(files.settings);
  const stored = readEnv(settingsText ?? "");

  // Saving on every change is the project's, not the machine's: it is kept in the compose file.
  if (values["auto-dump"] && values["no-auto-dump"]) throw new UsageError("--auto-dump and --no-auto-dump cannot both be given");
  const autoDump = values["auto-dump"] ? true : values["no-auto-dump"] ? false : (known?.autoDump ?? true);
  // While it was on, the board's database was inside the container. A file in the data folder is
  // then from before and older than the dump, and with saving off the server would open it,
  // never read the dump, and write the old board over the dump when it stops.
  const leftover = path.join(dir, "data", "k-spec.db");
  if (!autoDump && known?.autoDump !== false && local.fileExists(leftover)) {
    throw new Refused(
      `${leftover} is a database from before this project saved on every change; with saving off it would be used instead of the dump (remove .k-spec/data/k-spec.db* and run this again)`,
    );
  }

  const name = projectName(values.name ?? known?.name ?? path.basename(cwd));
  const projectId = known?.id ?? hex(local.randomBytes(8));
  const renamed = known !== null && name !== known.name;
  const slug = known !== null && !renamed ? known.slug : slugOf(name) || `p${projectId.slice(0, 8)}`;
  // Only a new slug moves the container; "My App" to "my app" changes the name and nothing in Docker.
  const movedFrom = known !== null && slug !== known.slug ? `k-spec-${known.slug}` : null;
  const host = values.host === undefined ? null : hostName(values.host);
  const port = await boardPort(values.port, stored[ENV_KEYS.port], local);

  // Only what is missing, or what the person asked to change, goes into the settings file.
  const changes = {};
  if (!stored[ENV_KEYS.token]) changes[ENV_KEYS.token] = Buffer.from(local.randomBytes(24)).toString("base64url");
  if (port !== null) changes[ENV_KEYS.port] = port;
  if (host !== null) changes[ENV_KEYS.host] = host;
  else if (!stored[ENV_KEYS.host]) changes[ENV_KEYS.host] = "localhost";
  const owner = local.user();
  if (!stored[ENV_KEYS.uid]) changes[ENV_KEYS.uid] = String(owner.uid);
  if (!stored[ENV_KEYS.gid]) changes[ENV_KEYS.gid] = String(owner.gid);
  if (!stored[ENV_KEYS.project]) changes[ENV_KEYS.project] = `k-spec-${slug}-${hex(local.randomBytes(3))}`;

  const attempt = (target, action) => {
    try {
      action();
    } catch (error) {
      throw new Refused(`cannot write ${target}: ${error.code ?? error.message}`);
    }
  };
  const write = (file, text, mode = 0o644) => attempt(file, () => local.writeFile(file, text, mode));
  const makeDir = (folder) => attempt(folder, () => local.makeDir(folder));

  makeDir(dir);
  // Made here, as the person: a folder Docker creates for a mount would belong to root.
  makeDir(path.join(dir, "data"));
  write(files.gitignore, renderGitignore());
  write(files.settings, mergeEnv(settingsText, changes), 0o600);
  write(files.compose, renderCompose({ image, name, slug, projectId, autoDump }));
  write(files.launcher, renderLauncher({ image, slug, projectId }), 0o755);

  // In k-spec's own repository the skill folder is a link to the skill's source: never write through it.
  const skillDir = path.join(cwd, ".claude", "skills", "k-spec");
  const skillLinked = local.isSymlink(skillDir);
  if (!skillLinked) {
    makeDir(skillDir);
    write(path.join(skillDir, "SKILL.md"), renderProjectSkill(local.readSkill()));
  }

  const toCommit = [".k-spec/compose.yaml", ".k-spec/k-spec", ".k-spec/.gitignore", ...(skillLinked ? [] : [".claude/skills/k-spec/SKILL.md"])];
  out(
    [
      `k-spec is set up for "${oneLine(name)}" (board k-spec-${slug}, port ${port ?? stored[ENV_KEYS.port]}, image ${image}).`,
      "",
      "Start the board:   docker compose -f .k-spec/compose.yaml up -d --wait",
      "Access link:       docker compose -f .k-spec/compose.yaml logs k-spec",
      `Commit:            ${toCommit.join(" ")}`,
      autoDump
        ? "                   and .k-spec/data/k-spec.dump.json, there as soon as the board has started"
        : "                   and .k-spec/data/k-spec.dump.json, written when the board stops",
      ...(skillLinked ? ["", "Skill not written: .claude/skills/k-spec is a link."] : []),
      ...(movedFrom === null
        ? []
        : ["", `The board's container was ${movedFrom} until now. To move it to k-spec-${slug}: stop any running watch, then docker compose -f .k-spec/compose.yaml up -d`]),
    ].join("\n"),
  );
}

/** The command that sets a project up. It talks to no server (`lazy`), only to the folder it runs in. */
export const INIT_COMMANDS = {
  init: {
    usage: "init [--name <name>] [--port <n>] [--host <name>] [--auto-dump | --no-auto-dump]",
    summary: "set this folder up as a k-spec project: board, launcher, settings and skill (run from the k-spec image; no server needed)",
    options: {
      name: { type: "string" },
      port: { type: "string" },
      host: { type: "string" },
      "auto-dump": { type: "boolean" },
      "no-auto-dump": { type: "boolean" },
    },
    arity: [0, 0],
    lazy: true,
    run: init,
  },
};
