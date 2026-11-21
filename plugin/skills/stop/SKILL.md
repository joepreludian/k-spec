---
name: stop
description: Use when the user types /k-spec:stop to stop this project's k-spec board.
disable-model-invocation: true
---

# k-spec: stop the board

If the project has no `.k-spec/k-spec`, there is no board here that this command stops. Say so,
and stop. (A board run from source, as in the k-spec repository itself, is the user's own
server.)

1. **Stop watching.** End any monitor this session started to watch the board for requests. It
   would only report the board as away.

2. **Stop the board's container.** Read the `START=` line of `.k-spec/k-spec` and run the
   command that belongs to it, in the checkout that has `.k-spec/.env`: this one, or else the
   one among the folders `git worktree list` prints.

   | `START` is | Run |
   |---|---|
   | `docker compose up -d k-spec` | `docker compose stop k-spec` |
   | `docker compose -f .k-spec/compose.yaml up -d` | `docker compose -f .k-spec/compose.yaml stop` |

   Each of the two stops the board's container and nothing else. In the first form the board
   is one service of the project's own compose file: the other services are the user's and
   stay as they are. The container is kept, so the board starts again quickly.

3. **Look at the board's file.** In that same checkout (it is the one the board writes to),
   run `git status --short .k-spec/data/k-spec.dump.json`. If it prints the file, the board
   has changes that are not committed. Tell the user, and give them the way to commit it
   there: `git add .k-spec/data/k-spec.dump.json`, then a commit. Commit nothing unless the
   user asks.

4. **Say what happened:** the board is stopped, and `/k-spec:use` starts it again.
