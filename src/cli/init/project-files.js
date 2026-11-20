// The files `k-spec init` puts into a project, as text. Everything here is pure: the command
// (init-command.js) decides the values and does the writing.

/** A name reduced to what Docker accepts in a container name: `[a-z0-9-]`, at most 40 characters. May be empty. */
export function slugOf(name) {
  const trim = (text) => text.replace(/^-+|-+$/g, "");
  return trim(trim(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 40));
}

const HEADER = "# k-spec-project: ";

/**
 * `.k-spec/compose.yaml`: the board service of one project. Container and network carry the
 * slug, so they do not depend on the folder; everything that differs per machine (token, port,
 * host name, owner) comes from `.env` beside the file, under names of its own, so nothing
 * exported in a shell for the server or the CLI leaks in. The first line is the project itself
 * (id, name, slug), which `init` reads back when it runs again or in a fresh clone.
 */
export function renderCompose({ image, name, slug, projectId }) {
  // A JSON string is a YAML double-quoted string; Compose then needs each $ doubled to leave it alone.
  const nameYaml = JSON.stringify(name).replaceAll("$", "$$$$");
  return `${HEADER}${JSON.stringify({ id: projectId, name, slug })}
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
    volumes:
      - ./data:/data
      - ..:/project:ro
    labels:
      k-spec.project: "${projectId}"
networks:
  default:
    name: k-spec-${slug}
`;
}

const filled = (value) => typeof value === "string" && value.length > 0;

/** The project a compose file written by `renderCompose` belongs to: `{ id, name, slug }`, or null for any other text. */
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
  return filled(id) && filled(name) && filled(slug) ? { id, name, slug } : null;
}

/** `.k-spec/.gitignore`: what stays on this machine. The dump next to the database is what gets committed. */
export function renderGitignore() {
  return ["# Written by `k-spec init`. The board's dump (data/k-spec.dump.json) is the part to commit.", ".env", "data/*.db*", "data/k-spec.server.json", ""].join("\n");
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

const ENV_LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/** The `KEY=VALUE` lines of a settings file as an object; comments and anything else are skipped. */
export function readEnv(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const [, key, value] = ENV_LINE.exec(line.replace(/\r$/, "")) ?? [];
    if (key) values[key] = value.trim();
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
    const [, key] = ENV_LINE.exec(line.replace(/\r$/, "")) ?? [];
    if (!key || !pending.has(key)) return line;
    pending.delete(key);
    return `${key}=${values[key]}`;
  });
  for (const key of [...pending].sort(order)) merged.push(`${key}=${values[key]}`);
  return `${merged.join("\n")}\n`;
}

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/;

const PROJECT_NOTE = `
> **In this project the \`k-spec\` command is the file \`.k-spec/k-spec\`**, at the project root. It
> runs the command in Docker against this project's own board. Wherever this skill writes
> \`k-spec <something>\`, run \`.k-spec/k-spec <something>\` from the project root; the Monitor
> command is \`.k-spec/k-spec watch\`. The board's dump and database are in \`.k-spec/data/\`.
`;

/** The skill as a project gets it: the source, with one note after the front matter saying where the command is. */
export function renderProjectSkill(source) {
  const [frontMatter] = FRONT_MATTER.exec(source) ?? [];
  if (!frontMatter) throw new Error("the skill has no front matter");
  return `${frontMatter}${PROJECT_NOTE}${source.slice(frontMatter.length)}`;
}
