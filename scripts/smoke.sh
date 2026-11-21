#!/bin/sh
# Proves a k-spec image end to end, the way a person and an agent would use it: sets a scratch
# project up with `k-spec init`, starts its board, and drives it through the project's launcher.
#
#   sh scripts/smoke.sh <image>          e.g. sh scripts/smoke.sh k-spec:dev
#
# The image must have been built with its own name: --build-arg K_SPEC_IMAGE=<image>.
# Prints one "ok: ..." line per check and stops at the first that does not hold ("FAIL: ...",
# exit 1). Containers, networks and the scratch folders are removed either way.
set -eu

IMAGE=${1:?usage: smoke.sh <image>}
ME="$(id -u):$(id -g)"
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/k-spec-smoke.XXXXXX")
NAME="smoke $$"                    # a space on purpose: the folder's name becomes the board's
BOARD="k-spec-smoke-$$"
ONE="$ROOT/one/$NAME"              # the project
TWO="$ROOT/two/elsewhere $$"       # a second project, set up while the first holds its port
TWIN="$ROOT/twin/$NAME"            # a different project that happens to have the same name
INC="$ROOT/inc/included $$"        # a project with a compose file of its own, which includes the board
ID=
WATCH_PID=

ok() { printf 'ok: %s\n' "$1"; }
fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

# compose <project folder> <arguments>: docker compose for that project, from its root.
compose() {
  folder=$1
  shift
  (cd "$folder" && docker compose -f .k-spec/compose.yaml "$@")
}

cleanup() {
  status=$?
  trap - EXIT INT TERM
  [ -z "$WATCH_PID" ] || kill "$WATCH_PID" 2>/dev/null || true
  if [ -f "$INC/compose.yaml" ]; then
    (cd "$INC" && docker compose down --timeout 5 --remove-orphans) >/dev/null 2>&1 || true
  fi
  for folder in "$TWIN" "$TWO" "$ONE"; do
    if [ -f "$folder/.k-spec/.env" ]; then
      compose "$folder" down --timeout 5 --remove-orphans >/dev/null 2>&1 || true
    fi
  done
  if [ -n "$ID" ]; then
    left=$(docker ps -aq --filter "label=k-spec.project=$ID" 2>/dev/null || true)
    [ -z "$left" ] || docker rm -f $left >/dev/null 2>&1 || true
  fi
  rm -rf "$ROOT"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# init <project folder> [options]: `k-spec init` from the image, as the README gives it.
init() {
  folder=$1
  shift
  docker run --rm --network host -u "$ME" -v "$folder:$folder" -w "$folder" "$IMAGE" k-spec init "$@"
}

# setting <project folder> <key>: a value from that project's settings file.
setting() { sed -n "s/^$2=//p" "$1/.k-spec/.env"; }

# k <arguments>: the project's launcher, called from somewhere else on purpose.
k() { (cd "$ROOT" && "$ONE/.k-spec/k-spec" "$@"); }

# wait_for <seconds> <what> <command>: until the command succeeds, or fail after that long.
wait_for() {
  left=$1
  what=$2
  shift 2
  until "$@" >/dev/null 2>&1; do
    left=$((left - 1))
    [ "$left" -gt 0 ] || fail "timed out waiting for $what"
    sleep 1
  done
}

# http <path> [cookie]: the status the board answers with, asked from this machine's network.
http() {
  docker run --rm --network host "$IMAGE" node -e '
    const [url, cookie] = process.argv.slice(1);
    fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} }).then(
      (res) => console.log(res.status, (res.headers.get("set-cookie") ?? "").split("=")[0]),
      () => console.log("none"),
    );' "http://localhost:$PORT$1" "${2-}"
}

cli_containers() { docker ps -aq --filter "label=k-spec.project=$ID" --filter "label=k-spec.role=cli"; }
no_cli_containers() { [ -z "$(cli_containers)" ]; }

watch_start() {
  "$ONE/.k-spec/k-spec" watch >"$1" 2>"$1.err" &
  WATCH_PID=$!
}
watch_stop() {
  kill -TERM "$WATCH_PID"
  wait "$WATCH_PID" && ended=0 || ended=$?
  WATCH_PID=
  [ "$ended" -eq 0 ] || fail "a watch that was told to stop exited $ended"
  wait_for 15 "the watch's container to be removed" no_cli_containers
}

docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "no such image: $IMAGE (build it first)"
mkdir -p "$ONE" "$TWO" "$TWIN" "$INC"

# 1. init
init "$ONE" >"$ROOT/init.out" 2>&1 || {
  cat "$ROOT/init.out" >&2
  fail "init in a fresh folder"
}
for file in .k-spec/compose.yaml .k-spec/k-spec .k-spec/.gitignore .k-spec/.env .claude/skills/k-spec/SKILL.md; do
  [ -f "$ONE/$file" ] || fail "init did not write $file"
done
[ -d "$ONE/.k-spec/data" ] || fail "init did not make .k-spec/data"
[ -x "$ONE/.k-spec/k-spec" ] || fail "the launcher is not executable"
grep -qF "image: $IMAGE" "$ONE/.k-spec/compose.yaml" || fail "the project is not pinned to $IMAGE: was the image built with --build-arg K_SPEC_IMAGE=$IMAGE?"
grep -qF "container_name: $BOARD" "$ONE/.k-spec/compose.yaml" || fail "the board is not named after the folder ($BOARD)"
ID=$(sed -n '1s/.*"id":"\([0-9a-f]*\)".*/\1/p' "$ONE/.k-spec/compose.yaml")
[ -n "$ID" ] || fail "the compose file does not carry the project id"
PORT=$(setting "$ONE" K_SPEC_BOARD_PORT)
[ "$PORT" -ge 14201 ] && [ "$PORT" -le 14299 ] || fail "the port init chose ($PORT) is not between 14201 and 14299"
TOKEN=$(setting "$ONE" K_SPEC_BOARD_TOKEN)
[ -n "$TOKEN" ] || fail "init wrote no token"
! grep -qF "$TOKEN" "$ROOT/init.out" || fail "init printed the token"
ok "init set up \"$NAME\" as $BOARD on port $PORT"

# 2. the board starts, prints its link, and is closed without the token
compose "$ONE" up -d --wait >"$ROOT/up.out" 2>&1 || {
  cat "$ROOT/up.out" >&2
  compose "$ONE" logs >&2 || true
  fail "the board did not start"
}
compose "$ONE" logs k-spec 2>&1 | grep -qF "k-spec board: http://localhost:$PORT/?token=$TOKEN" || fail "the logs do not show the access link"
[ "$(http /)" = "307 " ] || fail "without the token the board should send the browser to /access, got: $(http /)"
[ "$(http /access)" = "200 " ] || fail "/access should answer without the token"
[ "$(http "/?token=$TOKEN")" = "307 k-spec-token-$PORT" ] || fail "the access link should set the cookie named for port $PORT, got: $(http "/?token=$TOKEN")"
[ "$(http / "k-spec-token-$PORT=$TOKEN")" = "200 " ] || fail "the cookie named for the port should open the board"
[ "$(http / "k-spec-token-1=$TOKEN")" = "307 " ] || fail "a cookie named for another port must not open the board"
ok "the board is up, printed its access link, and only opens with the token"

# 3. the launcher
out=$(k add Backlog "Smoke card") || fail "the launcher could not add a card"
[ "$out" = "#1 created in Backlog" ] || fail "add printed: $out"
k board >"$ROOT/board.out" || fail "the launcher could not read the board"
grep -q "^$NAME  v" "$ROOT/board.out" || fail "the board is not named after the folder: $(head -1 "$ROOT/board.out")"
grep -q "#1 .*Smoke card" "$ROOT/board.out" || fail "the new card is not on the board"
[ "$(grep -c '^  #' "$ROOT/board.out")" -eq 1 ] || fail "a new project's board should hold nothing but the card just added"
ok "the launcher added a card to an otherwise empty board named \"$NAME\""

# 3b. the board is saved on every change, and its database is not in the project
grep -qF '"Smoke card"' "$ONE/.k-spec/data/k-spec.dump.json" || fail "the dump does not hold a change made a moment ago"
ok "a change is in the dump while the board runs"
[ -z "$(find "$ONE/.k-spec/data" -name 'k-spec.db*')" ] || fail "a database file is in the project's data folder: $(ls "$ONE/.k-spec/data")"
ok "the project's folder holds no database"

# 4. a request reaches a running watch
k comment 1 "Please check" --request >/dev/null || fail "the launcher could not send a request"
watch_start "$ROOT/watch1.out"
wait_for 60 "watch to print the request" grep -q '^request #1 Smoke card' "$ROOT/watch1.out"
# The image's health check is the server's; a container that only runs a command must not have one.
[ "$(docker inspect --format '{{if .State.Health}}checked{{else}}none{{end}}' "$(cli_containers)")" = none ] || fail "the watch's container runs the server's health check"
ok "watch printed the open request"

# 5. a stopped watch leaves nothing
watch_stop
ok "the stopped watch ended with exit 0 and left no container"

# 6. the reply goes through stdin untouched and closes the request
printf 'Looked at it: all `fine`, $HOME stays as typed.\n' | k comment 1 - --agent Smoke >/dev/null || fail "a reply through stdin"
k show 1 >"$ROOT/show.out" || fail "show"
grep -qF 'all `fine`, $HOME stays as typed.' "$ROOT/show.out" || fail "the reply did not arrive as typed"
! k board | grep -q "request" || fail "the request is still open after the agent's reply"
ok "a reply through stdin arrived as typed and answered the request"

# 7. a running watch lives through the board going away and coming back
watch_start "$ROOT/watch2.out"
wait_for 60 "the second watch to start" grep -q '^watching ' "$ROOT/watch2.out"
compose "$ONE" stop >/dev/null 2>&1 || fail "docker compose stop"
wait_for 60 "watch to report the board away" grep -q '^k-spec: server not' "$ROOT/watch2.out"
k board >/dev/null 2>"$ROOT/stopped.err" && fail "the launcher answered while the board was stopped"
grep -qF "start it with docker compose -f .k-spec/compose.yaml up -d" "$ROOT/stopped.err" || fail "a stopped board should say how to start it, got: $(cat "$ROOT/stopped.err")"
compose "$ONE" start >/dev/null 2>&1 || fail "docker compose start"
wait_for 120 "watch to report the board back" grep -q '^k-spec: connected' "$ROOT/watch2.out"
watch_stop
ok "a running watch reported the board away and back, and the launcher said how to start it"

# 8. the store scripts run inside the board's container
wait_for 60 "the board to answer again" k board
compose "$ONE" exec -T k-spec npm run db:dump >"$ROOT/dump.out" 2>&1 || {
  cat "$ROOT/dump.out" >&2
  fail "npm run db:dump inside the board's container"
}
grep -qF '"Smoke card"' "$ONE/.k-spec/data/k-spec.dump.json" || fail "the dump does not hold the card"
ok "npm run db:dump works inside the container"

# 9. a port in use is refused, and nothing is written
if init "$TWO" --port "$PORT" >"$ROOT/init2.out" 2>&1; then fail "init accepted port $PORT while the first board holds it"; fi
grep -qF "port $PORT is in use" "$ROOT/init2.out" || fail "the refusal does not name the port: $(cat "$ROOT/init2.out")"
[ ! -e "$TWO/.k-spec" ] || fail "a refused init wrote files"
ok "init refused the port the board is using"

# 10. a second project with the same name cannot take the first one's place
init "$TWIN" >/dev/null 2>&1 || fail "init in a second folder with the same name"
[ "$(setting "$TWIN" K_SPEC_BOARD_PORT)" != "$PORT" ] || fail "the second project was given the port the first board holds"
if compose "$TWIN" up -d --wait >"$ROOT/twin.out" 2>&1; then fail "a second project with the same name started a board"; fi
# Docker must have refused it because of the name, not for some other reason.
grep -qF "$BOARD" "$ROOT/twin.out" || fail "the second project failed to start, but not over the name: $(tail -1 "$ROOT/twin.out")"
[ -z "${SMOKE_VERBOSE-}" ] || tail -1 "$ROOT/twin.out"
[ "$(docker container inspect --format '{{ index .Config.Labels "k-spec.project" }}' "$BOARD")" = "$ID" ] || fail "the first project's board was replaced"
k board >/dev/null || fail "the first board stopped answering"
"$TWIN/.k-spec/k-spec" board >/dev/null 2>"$ROOT/twin.err" && fail "the second project's launcher reached the first project's board"
grep -qF "belongs to another project" "$ROOT/twin.err" || fail "the second launcher should say whose board that is, got: $(cat "$ROOT/twin.err")"
ok "a second project with the same name could not start, and its launcher refuses the first one's board"

# 11. stopping is quick, removes the note, and has nothing left to save
k add Todo "Added before the stop" >/dev/null || fail "adding a second card"
grep -qF '"Added before the stop"' "$ONE/.k-spec/data/k-spec.dump.json" || fail "the dump lacks the last change before the stop"
cp "$ONE/.k-spec/data/k-spec.dump.json" "$ROOT/before-stop.json"
began=$(date +%s)
compose "$ONE" stop >/dev/null 2>&1 || fail "docker compose stop"
took=$(($(date +%s) - began))
[ "$took" -lt 9 ] || fail "stopping took ${took}s: the server did not stop by itself"
[ ! -e "$ONE/.k-spec/data/k-spec.server.json" ] || fail "the server's note is still there after the stop"
cmp -s "$ROOT/before-stop.json" "$ONE/.k-spec/data/k-spec.dump.json" || fail "stopping changed a dump that already held every change"
ok "stopping the board took ${took}s, removed the note and left the dump as it was"

# 11b. a dump replaced on disk (a git pull) is what the board shows after a restart
compose "$ONE" start >/dev/null 2>&1 || fail "docker compose start"
wait_for 60 "the board to answer again" k board
k add Todo "Not in the pulled dump" >/dev/null || fail "adding a third card"
cp "$ROOT/before-stop.json" "$ONE/.k-spec/data/k-spec.dump.json"
compose "$ONE" restart >/dev/null 2>&1 || fail "docker compose restart"
wait_for 60 "the board to answer after the restart" k board
cmp -s "$ROOT/before-stop.json" "$ONE/.k-spec/data/k-spec.dump.json" || fail "restarting the board overwrote a dump that was replaced on disk"
k board >"$ROOT/restarted.out" || fail "the launcher could not read the restarted board"
! grep -q "Not in the pulled dump" "$ROOT/restarted.out" || fail "the restarted board did not start from the dump on disk"
grep -q "Added before the stop" "$ROOT/restarted.out" || fail "the restarted board lost a card that is in the dump"
ok "a dump replaced on disk is what the board shows after a restart"

# 11c. the container can be thrown away: the dump is the board
compose "$ONE" down --timeout 5 >/dev/null 2>&1 || fail "docker compose down"
compose "$ONE" up -d --wait >/dev/null 2>&1 || fail "the board did not start again after its container was removed"
k board >"$ROOT/recreated.out" || fail "the launcher could not read the recreated board"
grep -q "Smoke card" "$ROOT/recreated.out" && grep -q "Added before the stop" "$ROOT/recreated.out" || fail "the recreated board does not hold the cards of the dump"
ok "the board came back from the dump after its container was removed"

# 12. nothing belongs to anyone but the caller
strangers=$(find "$ONE" ! -user "$(id -u)" 2>/dev/null | head -5)
[ -z "$strangers" ] || fail "files not owned by the caller: $strangers"
ok "every file in the project belongs to the caller"

# 13. with the board gone, the launcher says so
compose "$ONE" down --timeout 5 >/dev/null 2>&1 || fail "docker compose down"
k board >/dev/null 2>"$ROOT/down.err" && fail "the launcher answered with no board"
grep -qF "this project's board is not running" "$ROOT/down.err" || fail "with no board the launcher should say so, got: $(cat "$ROOT/down.err")"
ok "with the board removed the launcher says it is not running"

# 14. a project that turned saving on every change off: the database is the board until it stops
init "$TWO" --no-auto-dump >"$ROOT/init-off.out" 2>&1 || {
  cat "$ROOT/init-off.out" >&2
  fail "init --no-auto-dump"
}
compose "$TWO" up -d --wait >/dev/null 2>&1 || fail "the board of the project with saving off did not start"
"$TWO/.k-spec/k-spec" add Backlog "Kept in the database" >/dev/null || fail "adding a card with saving off"
! grep -qsF '"Kept in the database"' "$TWO/.k-spec/data/k-spec.dump.json" || fail "with saving off a change was written to the dump at once"
[ -f "$TWO/.k-spec/data/k-spec.db" ] || fail "with saving off the database should be in the data folder: $(ls "$TWO/.k-spec/data")"
compose "$TWO" stop >/dev/null 2>&1 || fail "docker compose stop (saving off)"
grep -qF '"Kept in the database"' "$TWO/.k-spec/data/k-spec.dump.json" || fail "with saving off, stopping did not write the dump"
compose "$TWO" down --timeout 5 >/dev/null 2>&1 || fail "docker compose down (saving off)"
ok "with saving off the dump is written when the board stops, and the database is in the data folder"

# 15. a board that is part of the project's own compose file
init "$INC" >/dev/null 2>&1 || fail "init in the project that has a compose file"
cat >"$INC/compose.yaml" <<EOF
include:
  - .k-spec/compose.yaml
services:
  idle:
    image: $IMAGE
    init: true
    command: ["node", "-e", "setInterval(() => {}, 1e9)"]
    healthcheck:
      disable: true
EOF
init "$INC" >"$ROOT/init-inc.out" 2>&1 || {
  cat "$ROOT/init-inc.out" >&2
  fail "init again, after the board was included"
}
grep -qF "part of compose.yaml" "$ROOT/init-inc.out" || fail "init did not see that the board is included: $(head -1 "$ROOT/init-inc.out")"
grep -qF "START='docker compose up -d k-spec'" "$INC/.k-spec/k-spec" || fail "the launcher of an included board does not name the project's start command"
(cd "$INC" && docker compose up -d --wait) >"$ROOT/inc-up.out" 2>&1 || {
  cat "$ROOT/inc-up.out" >&2
  fail "the project's own docker compose up did not start with the board included"
}
"$INC/.k-spec/k-spec" add Backlog "Included" >/dev/null || fail "the launcher of the included board could not add a card"
grep -qF '"Included"' "$INC/.k-spec/data/k-spec.dump.json" || fail "the included board did not save to its own data folder"
ok "a board included in the project's compose file starts with it, and its launcher works"

idle=$(cd "$INC" && docker compose ps -q idle)
[ -n "$idle" ] || fail "the project's own service is not running"
nets=$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$idle")
case "$nets" in
  *k-spec-*) fail "the project's own service was put on the board's network: $nets" ;;
esac
ok "the project's own services keep their default network"

(cd "$INC" && docker compose rm -sf k-spec) >/dev/null 2>&1 || fail "removing the included board's container"
"$INC/.k-spec/k-spec" board >/dev/null 2>"$ROOT/inc.err" && fail "the launcher answered with the included board removed"
grep -qF "start it with: docker compose up -d k-spec" "$ROOT/inc.err" || fail "the launcher should name the project's start command, got: $(cat "$ROOT/inc.err")"
(cd "$INC" && docker compose down --timeout 5) >/dev/null 2>&1 || fail "docker compose down in the project with the included board"
ok "with the board's container removed the launcher names the project's start command"

printf 'smoke test passed: %s\n' "$IMAGE"
