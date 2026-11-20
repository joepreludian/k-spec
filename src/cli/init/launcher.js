/**
 * `.k-spec/k-spec`: the k-spec command of one project, as a POSIX sh script. Every call is one
 * container of the pinned image that is removed when the command ends. It reaches the board
 * through the board's own network and data folder (where the server leaves its note), so it
 * works from any directory, and it never takes a server address or token from the caller: this
 * project's board is the only one it can talk to.
 *
 * `image`, `slug` and `projectId` are written as single-quoted shell words; the caller makes
 * sure none of them holds a quote.
 */
export function renderLauncher({ image, slug, projectId }) {
  return `#!/bin/sh
# Written by \`k-spec init\` and rewritten every time it runs: do not edit.
# The k-spec command for this project's board. Each call runs once in a container of the image
# below, next to the board, and leaves nothing behind.
set -eu

IMAGE='${image}'
BOARD='k-spec-${slug}'
PROJECT='${projectId}'
START='docker compose -f .k-spec/compose.yaml up -d'

fail() {
  printf 'error: %s\\n' "$1" >&2
  exit 3
}

command -v docker >/dev/null 2>&1 || fail 'docker not found'

# The board must be this project's: another project with the same name would answer otherwise.
owner=$(docker container inspect --format '{{ index .Config.Labels "k-spec.project" }}' "$BOARD" 2>/dev/null) ||
  fail "this project's board is not running (start it with: $START)"
[ "$owner" = "$PROJECT" ] ||
  fail "the board running as $BOARD belongs to another project (run k-spec init again with --name <another name>)"

# What \`k-spec start\` records: inside the container these would describe the container.
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || branch=
[ "$branch" != HEAD ] || branch=
host=$(uname -n 2>/dev/null) || host=

# No terminal is asked for: the output is read by programs. --init makes a closed terminal
# (SIGHUP) end the command too, so a stopped watch never leaves a container. The image's health
# check is for the server; here it would only fail, once a second at first.
exec docker run --rm --init -i \\
  --no-healthcheck \\
  --network "$BOARD" \\
  --volumes-from "$BOARD:ro" \\
  --user "$(id -u):$(id -g)" \\
  --label "k-spec.project=$PROJECT" \\
  --label k-spec.role=cli \\
  -e K_SPEC_AGENT \\
  -e "K_SPEC_BRANCH=$branch" \\
  -e "K_SPEC_HOSTNAME=$host" \\
  -e "K_SPEC_START_HINT=$START" \\
  "$IMAGE" k-spec "$@"
`;
}
