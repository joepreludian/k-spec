---
name: setup
description: Use when the user types /k-spec:setup to give a project a k-spec board, to set this machine up for a board the project already has, or to update the project to a newer k-spec.
disable-model-invocation: true
argument-hint: "[image]"
---

# k-spec: set a project up

k-spec is a kanban board for handing work to AI agents. A card is a piece of work; the agent
reads it, answers on it and ticks its checklist through a command. Each project has its own
board: one Docker container, saved into the project as a file that is committed.

**The image.** `$ARGUMENTS` when the user gave one (a local build such as `k-spec:dev`),
otherwise `docker.io/joepreludian/k-spec:latest`. Below it is written `<image>`.

**The folder.** Work from the project folder: the git top level
(`git rev-parse --show-toplevel`), or the current folder when there is no repository.

## 1. What is needed

Run `docker version` and `docker compose version`. Docker with Compose 2.20 or newer is needed.
If either is missing, tell the user what to install, and stop.

## 2. Which case

Check in this order and take the first that fits.

| What you find | Case |
|---|---|
| `.k-spec/k-spec board` answers, and this checkout has no `.k-spec/.env` | Nothing to set up: this checkout uses the board of another checkout on this machine. Say so, and stop. |
| `git rev-parse --git-dir` and `git rev-parse --git-common-dir` differ (a git worktree) | Never set up here: the board's data would live in the worktree. Name the main checkout (the first line of `git worktree list`), say to run `/k-spec:setup` there, and stop. |
| No `.k-spec/compose.yaml` | A new project: step 3. |
| `.k-spec/compose.yaml`, but no `.k-spec/.env` | A clone on a new machine: step 4. |
| Both | Already set up here: step 5. |

## 3. A new project

Explain, then ask. Say all of this, briefly:

- What k-spec is: the paragraph at the top, in your own words.
- What will be written, and committed: `.k-spec/compose.yaml`, `.k-spec/k-spec` (the project's
  `k-spec` command), `.k-spec/.gitignore`, `.claude/skills/k-spec/SKILL.md` (how an agent uses
  the board) and `.k-spec/data/k-spec.dump.json` (the board itself).
- What will be written and never committed: `.k-spec/.env`, this machine's access token and port.
- What will run: one container, on a free port between 14201 and 14299, which comes back after
  a reboot. Nothing is installed on the machine besides the image.
- This question: "If you will open the board from another machine than this one (a VM, a
  remote box), tell me the name it is reached by."

Wait for a yes. Then:

```bash
docker pull <image>
docker run --rm --network host -u "$(id -u):$(id -g)" -v "$PWD:$PWD" -w "$PWD" <image> k-spec init
```

- A pull that fails is fine when `docker image inspect <image>` finds the image on the machine.
- When the user gave a name for another machine, add `--host <name>` at the end of the second line.
- `init` picks the port and takes the folder's name for the project. If it refuses, show its
  `error:` line to the user: it says what to do.

Go on at step 6.

## 4. A clone on a new machine

Tell the user: the project already uses k-spec, this machine gets its own access token and
port, and no committed file changes. Wait for a yes. The image is the one the project is
pinned to:

```bash
sed -n 's/^ *image: //p' .k-spec/compose.yaml
```

Run the `docker run` line of step 3 with that image. Go on at step 7.

## 5. Already set up here

Tell the user which image the project is pinned to (the `sed` line of step 4) and whether its
board is running (`.k-spec/k-spec board`). Offer the update to `<image>`, and say what it
means: the compose file, the launcher and the skill are rewritten and need committing; the
board, the token and the port are kept; there is no way back to the older version.

Without a yes, stop here. With a yes: stop any monitor this session started to watch the
board, run the two lines of step 3, then go on at step 6.

## 6. The project's own compose file

This step applies when the project folder has a compose file (the first that exists of
`compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`) and that file does
not list `.k-spec/compose.yaml` under `include:` yet. Otherwise go on at step 7.

Offer two ways and suggest the first:

1. **Part of the project's compose file.** `docker compose up` in the project then starts the
   board with everything else. The cost: everyone who runs the project's compose needs k-spec
   set up on their machine first; until then `docker compose` stops and says so.
2. **Separate.** The board keeps a start command of its own.

For the first, add this entry to the top-level `include:` list of the project's compose file,
creating the key at the top of the file when there is none, and change nothing else in it:

```yaml
include:
  - .k-spec/compose.yaml
```

Then run `docker compose config --quiet`.

- **It fails:** take the edit back, tell the user, and keep the board separate.
- **It passes:** run the `docker run` line of step 3 again. `init` now writes the launcher for
  a board that is part of the project's compose file, and its first line says "part of" and
  names the file.

## 7. Start the board and hand over the link

The last `init` run printed a line "Start the board:" and a line "Access link:", each with a
command. Run the first. Then run the second and take its last line that contains
`k-spec board:`. Give that link to the user exactly as printed, once, and say: open it once
in the browser; it is the key to the board, so it is not for sharing or committing.

## 8. The basics

Tell the user, in a few lines:

- The board is used in the browser. An agent, or they in a terminal, uses `.k-spec/k-spec`;
  `.k-spec/k-spec help` lists its commands.
- "using k-spec" in a request, or `/k-spec:use`, has a task tracked on the board.
- "watch the board" has the agent pick up requests sent from a card.
- `/k-spec:stop` stops the board. The board is saved in `.k-spec/data/k-spec.dump.json` after
  every change, and that file is what puts it in git.

Then list what there is to commit: the files `init` named in its "Commit:" lines, and the
project's compose file if you edited it. Commit nothing unless the user asks.
