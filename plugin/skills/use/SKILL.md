---
name: use
description: Use when the user types /k-spec:use, or says "using k-spec", "use k-spec for this", "track this on the board" or "resume on k-spec". Never on your own initiative.
argument-hint: "[task | #card | resume]"
---

# k-spec: use the board in this session

The user asked for this project's k-spec board. Make sure the board is running, then work on it
the way the project's own k-spec skill says. What they asked for: `$ARGUMENTS`, or their message.

## 1. Find the board

Take the first that fits.

| What you find | Do |
|---|---|
| No `.k-spec/` folder, but `.claude/skills/k-spec/SKILL.md` is there (the k-spec repository itself, or a board run from source) | Go to step 3. That server is the user's: if the board does not answer, tell them, and never start it. |
| No `.k-spec/k-spec` | This project does not use k-spec yet. Tell the user to type `/k-spec:setup`, and stop. |
| `.k-spec/k-spec` is there | Go to step 2. |

## 2. Make sure it runs

Run `.k-spec/k-spec board`.

- **It prints the board:** go to step 3. A git worktree and a second clone print it too: they
  use the first checkout's board.
- **It says the board is not running and names a start command** ("start it with …"): that
  command needs this machine's settings, the file `.k-spec/.env`.
  - This checkout has the file: run the command here, with `--wait` added after `up -d`.
  - It does not: among the folders `git worktree list` prints, find the one that has
    `.k-spec/.env`, and run the command there, with `--wait` the same way.
  - No folder has it: this machine is not set up. Tell the user to type `/k-spec:setup` in the
    main checkout, and stop.

  Then run `.k-spec/k-spec board` again. If it still does not print the board, the board did
  not come up (a board file that cannot be read stops it, for one). Run the start command
  with `logs --tail 20 k-spec` in place of `up -d` and what follows it, show the user those
  last lines, and stop.
- **Any other `error:` line** (the board belongs to another project, docker not found, token
  rejected): show it to the user, and stop.

If you had to start the board, tell the user where it is. The start command with `logs k-spec`
in place of `up -d` and what follows it prints a line containing `k-spec board:`. Give the
address from that line up to the `?`, and leave the token out. The whole link is for a
browser that has not opened the board yet: give it when the user asks for it.

## 3. Work on the board

Read `.claude/skills/k-spec/SKILL.md` in the project and follow its section
"Working a task on the board" for what was asked: a new task, a card the user named, or
"resume". Typing this command is the user asking for the board: do not make that section's
offer, and do not ask whether to use the board.

If the file has no such section, the project is pinned to an older k-spec. Tell the user that
`/k-spec:setup` updates it, and that until then you can read cards and answer on them, as the
rest of that file says.
