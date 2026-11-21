// The files `k-spec init` puts into a project, as text. Everything here is pure: the command
// (init-command.js) decides the values and does the writing.

/** A name reduced to what Docker accepts in a container name: `[a-z0-9-]`, at most 40 characters. May be empty. */
export function slugOf(name) {
  const trim = (text) => text.replace(/^-+|-+$/g, "");
  return trim(trim(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, SLUG_LIMIT));
}

const HEADER = "# k-spec-project: ";

/** The first line of the compose file: the project. The switch is in it only when it is off. */
function header({ projectId, name, slug, autoDump }) {
  return `${HEADER}${JSON.stringify({ id: projectId, name, slug, ...(autoDump ? {} : { autoDump: false }) })}`;
}

/**
 * `.k-spec/compose.yaml`: the board service of one project. Container and network carry the
 * slug, so they do not depend on the folder; everything that differs per machine (token, port,
 * host name, owner) comes from `.env` beside the file, under names of its own, so nothing
 * exported in a shell for the server or the CLI leaks in. The first line is the project itself
 * (id, name, slug, and whether saving on every change is off), which `init` reads back when it
 * runs again or in a fresh clone.
 *
 * With saving on every change (`autoDump`, the default) the dump is the board and the database
 * a cache, kept inside the container. With it off the database is the board between two stops
 * and stays where the image puts it, in the data folder.
 *
 * The board has a network of its own. Redefining `default` would, once this file is included
 * in a project's own compose file, rename the network of that project's services.
 */
export function renderCompose({ image, name, slug, projectId, autoDump = true }) {
  // A JSON string is a YAML double-quoted string; Compose then needs each $ doubled to leave it alone.
  const nameYaml = JSON.stringify(name).replaceAll("$", "$$$$");
  const storage = autoDump ? "K_SPEC_DB: /tmp/k-spec.db" : 'K_SPEC_AUTO_DUMP: "off"';
  return `${header({ projectId, name, slug, autoDump })}
# Written by \`k-spec init\` and rewritten every time it runs: do not edit.
# This machine's settings (token, port, host name) are in .env beside this file.
name: "\${K_SPEC_BOARD_PROJECT:?this machine has no settings yet - run k-spec init in this project}"
services:
  k-spec:
    image: ${image}
    container_name: k-spec-${slug}
    user: "\${K_SPEC_BOARD_UID:?}:\${K_SPEC_BOARD_GID:?}"
    restart: unless-stopped
    ports:
      - "\${K_SPEC_BOARD_PORT:?}:\${K_SPEC_BOARD_PORT:?}"
    environment:
      PORT: "\${K_SPEC_BOARD_PORT:?}"
      K_SPEC_TOKEN: "\${K_SPEC_BOARD_TOKEN:?}"
      K_SPEC_HOST: "\${K_SPEC_BOARD_HOST:-localhost}"
      K_SPEC_BOARD_NAME: ${nameYaml}
      K_SPEC_NOTE_URL: "http://k-spec:\${K_SPEC_BOARD_PORT:?}"
      ${storage}
    volumes:
      - ./data:/data
      - ..:/project:ro
    networks:
      - k-spec
    labels:
      k-spec.project: "${projectId}"
networks:
  k-spec:
    name: k-spec-${slug}
`;
}

/** The names Compose looks for a project's compose file under, in its order of preference. */
export const PROJECT_COMPOSE_FILES = Object.freeze(["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]);

const BOARD_PATH = String.raw`(["']?)(?:\./)?\.k-spec/compose\.yaml\1\s*(?:#.*)?$`;
// `- .k-spec/compose.yaml`, `- path: .k-spec/compose.yaml`, or `path:` on a line of its own in a longer entry.
const BOARD_ENTRY = new RegExp(String.raw`^\s+(?:-\s*(?:path:\s*)?|path:\s*)` + BOARD_PATH);
const INCLUDE_KEY = /^include:\s*(?:#.*)?$/;

/**
 * Whether a project's own compose file runs the board as part of it: an entry for
 * `.k-spec/compose.yaml` in its top-level `include:` list. The text is read line by line, which
 * is enough for the block form people (and the k-spec plugin) write; the file is never parsed
 * as YAML and never written.
 */
export function composeIncludesBoard(text) {
  let inInclude = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    // A line that starts in the first column (and is not a comment) opens a top-level key.
    if (/^[^\s#]/.test(line)) inInclude = INCLUDE_KEY.test(line);
    else if (inInclude && BOARD_ENTRY.test(line)) return true;
  }
  return false;
}

// What init itself generates, and nothing else: the id and the slug are written into a shell
// script and a YAML file, and the line they are read from may come from someone else's repository.
const PROJECT_ID = /^[0-9a-f]{16}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_LIMIT = 40;

const filled = (value) => typeof value === "string" && value.length > 0;
const matches = (value, pattern) => typeof value === "string" && pattern.test(value);

/**
 * The project a compose file written by `renderCompose` belongs to: `{ id, name, slug, autoDump }`,
 * or null for any other text, including a header whose id or slug is not in the form init
 * writes. `autoDump` is true unless the header says `"autoDump":false`; any other value for that
 * key is not something init writes, and makes the header invalid.
 */
export function readComposeHeader(text) {
  const [first] = text.split("\n");
  if (!first.startsWith(HEADER)) return null;
  let project;
  try {
    project = JSON.parse(first.slice(HEADER.length));
  } catch {
    return null;
  }
  if (typeof project !== "object" || project === null) return null;
  const { id, name, slug } = project;
  const valid = matches(id, PROJECT_ID) && matches(slug, SLUG) && slug.length <= SLUG_LIMIT && filled(name);
  if (!valid) return null;
  if (!Object.hasOwn(project, "autoDump")) return { id, name, slug, autoDump: true };
  return project.autoDump === false ? { id, name, slug, autoDump: false } : null;
}

/**
 * `.k-spec/.gitignore`: what stays on this machine. The dump next to the database is what gets
 * committed, and the first two rules keep it so: a project's own .gitignore often ignores every
 * folder called `data`, which would take the board out of git without anyone noticing.
 */
export function renderGitignore() {
  return [
    "# Written by `k-spec init` and rewritten every time it runs: do not edit.",
    "# The board's dump (data/k-spec.dump.json) is the part of the board that is committed. The two",
    "# rules below keep it so even when the project's own .gitignore ignores a folder called data.",
    "!data/",
    "!data/k-spec.dump.json",
    ".env",
    "data/*.db*",
    "data/k-spec.server.json",
    "",
  ].join("\n");
}

/**
 * The keys of `.k-spec/.env`. None is a name the server or the CLI reads (`K_SPEC_TOKEN`,
 * `K_SPEC_HOST`, `PORT`, …): Compose prefers a variable exported in the shell over the file.
 */
export const ENV_KEYS = Object.freeze({
  token: "K_SPEC_BOARD_TOKEN",
  port: "K_SPEC_BOARD_PORT",
  host: "K_SPEC_BOARD_HOST",
  uid: "K_SPEC_BOARD_UID",
  gid: "K_SPEC_BOARD_GID",
  project: "K_SPEC_BOARD_PROJECT",
});

// `KEY=VALUE`, as Compose reads it: `export` in front is allowed.
const ENV_LINE = /^\s*(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;
const envLine = (line) => ENV_LINE.exec(line.replace(/\r$/, "")) ?? [];

/** A value as Compose takes it: without its quotes, or without the comment that follows it after white space. */
function envValue(raw) {
  const text = raw.trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    if (end > 0) return text.slice(1, end);
  }
  return text.replace(/\s+#.*$/, "").trim();
}

/**
 * The `KEY=VALUE` lines of a settings file as an object, read the way Compose reads them, so
 * that init and the board agree on what the file says. Comments and anything else are skipped.
 */
export function readEnv(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const [, , key, value] = envLine(line);
    if (key) values[key] = envValue(value);
  }
  return values;
}

const ENV_HEADER = [
  "# This machine's settings for the project's k-spec board. Written by `k-spec init`; not committed.",
  "# The token is the key to the board: whoever has it can open the board and instruct a watching agent.",
];

/**
 * The settings file with `values` set. An existing text keeps every line where it is: a line
 * whose key is in `values` gets the new value, keys not there yet are added at the end. With no
 * text (`null`) the file starts with a short header and the keys in `ENV_KEYS` order.
 */
export function mergeEnv(text, values) {
  const known = Object.values(ENV_KEYS);
  const order = (a, b) => (known.indexOf(a) + 1 || known.length + 1) - (known.indexOf(b) + 1 || known.length + 1);
  const lines = text === null ? [...ENV_HEADER] : text.replace(/\n$/, "").split("\n");
  const pending = new Set(Object.keys(values));
  const merged = lines.map((line) => {
    const [, exported = "", key] = envLine(line);
    if (!key || !pending.has(key)) return line;
    pending.delete(key);
    return `${exported}${key}=${values[key]}`;
  });
  for (const key of [...pending].sort(order)) merged.push(`${key}=${values[key]}`);
  return `${merged.join("\n")}\n`;
}

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/;

const PROJECT_NOTE = `
> **In this project the \`k-spec\` command is the file \`.k-spec/k-spec\`**, at the project root. It
> runs the command in Docker against this project's own board. Wherever this skill writes
> \`k-spec <something>\`, run \`.k-spec/k-spec <something>\` from the project root; the Monitor
> command is \`.k-spec/k-spec watch\`. The board's dump is \`.k-spec/data/k-spec.dump.json\`.
>
> This copy is written by \`k-spec init\` and rewritten every time it runs: change the skill in
> k-spec itself, not here.
`;

/** The skill as a project gets it: the source, with one note after the front matter saying where the command is. */
export function renderProjectSkill(source) {
  const [frontMatter] = FRONT_MATTER.exec(source) ?? [];
  if (!frontMatter) throw new Error("the skill has no front matter");
  return `${frontMatter}${PROJECT_NOTE}${source.slice(frontMatter.length)}`;
}
