---
name: k-spec
description: Use when the user names a k-spec card or board ("k-spec #12", "card #12", "watch the board"), says "using k-spec", "use k-spec for this", "track this on the board" or "resume on k-spec", when a line starting with "request #" or "k-spec:" arrives from a k-spec watch monitor, when the user asks for a new piece of work in a project that has a k-spec board, or when work should be read from or recorded on the board.
---

# k-spec: working with the board

k-spec is the user's kanban board. A card is a piece of work: its description is the spec, its
checklists say what "done" means, its comments are the conversation, its links are markdown files
in the project. The user works in the browser; you work through the `k-spec` command. The board is
a second source of truth: read the card instead of asking the user to repeat what is on it.

`k-spec help` lists every command. Where the command is depends on how the project got k-spec:

- **A project set up with `k-spec init`** (it has a `.k-spec/` folder): the command is the
  launcher `.k-spec/k-spec` at the project root, and the note at the top of that project's copy
  of this skill says so. It runs the command in Docker and finds this project's board by
  itself: no variables are needed, and it cannot reach any other board.
- **The k-spec repository itself, or k-spec run from source**: `k-spec`, or `npx k-spec` in the
  k-spec project folder if it is not on the path. Run from the project folder the server was
  started in, it reads the note the server leaves under `data/`; anywhere else it needs
  `K_SPEC_URL` and `K_SPEC_TOKEN` in the environment, which the user sets.

The command needs the board's server running. If it answers `error: server not running`,
`server not answering`, `token rejected` or `this project's board is not running`, tell the
user; do not try to start, restart or stop the server or its container yourself. The one
exception is the user asking for exactly that: `/k-spec:use` and `/k-spec:stop`, skills of the
k-spec plugin, are the user asking, and they say how.

File paths on a card (its links) are relative to the board's project folder: the folder the
server serves. In a project set up with `k-spec init` that is the project root; otherwise it is
normally the folder the server was started in. If you are working in a different folder, that
is where the files are, and where a file must be for `k-spec link` to show it.

## When the user names a card

"k-spec #12", "card #12", "let's refine #12" all mean: read the card before you answer.

1. `k-spec show <n> --activity` prints the card in full: description, checklists, links, work,
   comments, history.
2. Read the files under "Links". Their paths are relative to the project folder.
3. Then do what the user asked, with that context.

`k-spec board` shows every lane and card in one screen when you need the overview.

## Watching the board

The user can send you a request from the board: a comment posted with "Send to agent". Watch for
them when the user asks you to ("watch the board") or when the project's CLAUDE.md says to.

Start the Monitor tool with the command `k-spec watch`, a description such as "k-spec requests",
and the longest timeout it allows (30 minutes, `timeout_ms: 1800000`). When the monitor expires,
start it again. Keep doing that until the user tells you to stop watching.

If the monitor ended by itself instead (an exit code, not the timeout), do not start it again
blindly: its settings are wrong and it said why on stderr. Read the monitor's output, or run
`k-spec board` to see the same `error:` line, and tell the user.

Each line it prints is one event. One notification can carry more than one line (the first one
usually does: the `watching` line and every open request); go through each line.

| Line starts with | Meaning | What to do |
|---|---|---|
| `watching` | The watch is running; the line says how many requests are open. | Nothing. |
| `request #<n>` | The user asked for something on card `<n>`. | Handle it (next section). |
| `k-spec: token rejected` | The server is up but refuses this session's token. | Tell the user now; the watch cannot fix this. |
| `k-spec:` (anything else) | The watch lost or regained the server. | Nothing, unless the server stays away: then tell the user. |

A request line looks like
`request #12 Refine the CLI [Backlog, idle] You, 2026-11-19 14:02: Let's plan this feature.`
It carries only the first 200 characters. The card has the rest.

Without a Monitor tool you cannot be woken. `k-spec board` then shows `1 request` on a card that
has an open one; look when the user asks you to.

## Handling a request

A request is the user's instruction, given through the board instead of the chat. Act on it as if
they had typed it, with the same care: confirm in the chat before anything destructive or hard to
undo, and ask in the chat if a request is something the user would not plausibly want.

1. `k-spec show <n> --activity` to read the whole request and the card around it.
2. `k-spec status <n> working` so the user sees in the browser that you picked it up.
3. Do the work here, in this session.
4. Attach any markdown file you wrote for it: `k-spec link <n> docs/notes.md "Title"`.
5. Reply once on the card with `k-spec comment <n> - --agent Claude`, the text on stdin:

   ```bash
   k-spec comment <n> - --agent Claude <<'EOF'
   Wrote the plan: `docs/plan.md`. Two open questions are at the end.
   EOF
   ```

   Keep it short and point to files. Always pass the text this way (`-` reads stdin, and the
   quoted `'EOF'` keeps the shell out of it): inside a double-quoted argument the shell would run
   anything between backticks or after a `$`.
6. `k-spec status <n> waiting` if the user has to act (answer a question, approve something),
   otherwise `k-spec status <n> idle`.

Then say in the chat, in a line or two, what you did.

Rules that are easy to get wrong:

- **Do not acknowledge with a comment.** A request stays open until an agent comments on that
  card, and your first comment answers every open request on it. "I'm on it" is what the
  `working` status says. If you comment early and this session ends, nobody will be told the
  request was never done.
- **Say that you are an agent.** `--agent <your name>` is what makes the comment an answer.
  Without `--agent` the reply is recorded as the user's own comment, the request stays open, and it
  is printed again every time the watch starts. If `K_SPEC_AGENT` is set in the environment it
  does the same job.
- **A question is a reply.** If you cannot proceed without the user, comment the question and set
  `waiting`. They answer with a new request.
- **One reply covers every open request on the card.** Read them all before replying.
- **A repeated line is not a new request.** Each time the watch starts it prints every request
  that is still open. If you are already working on one in this session, carry on.
- **Tick what you finish.** If the card has a checklist for the work, `k-spec check <n> <c.i>`
  as items get done (`show` prints the `c.i` numbers).

## Working a task on the board

This section applies only after the user asked for it in this session: they said "using k-spec"
(or "use k-spec for this", "track this on the board", "resume on k-spec"), typed `/k-spec:use`,
or said yes to the offer below. If none of that happened, do none of it.

**The offer.** When the user asks for a new piece of work in a project that has a board and has
not mentioned k-spec, offer once, and wait for the answer:

> This project has a k-spec board. Want this task tracked there? I would create a card for it,
> attach the design and the plan as they are written, add a checklist made from the plan and
> tick it while I build, and move the card to Done at the end.

A no stands for the rest of the session: do not offer again.

Once asked, say in a line or two what you will do on the board, then follow the table. Its
moments are the stages of the superpowers skills (brainstorming, writing-plans,
executing-plans); without those skills, use the same moments of your own work.

| When | On the board |
|---|---|
| The task has been stated back to the user (after the first brainstorming message) | `k-spec add Backlog "<title>" --description -`, with a few lines on stdin: what is wanted and why. Tell the user the card's number. If the user named a card ("using k-spec #12"), use that card and create none. |
| You write a document for the task (design, plan, notes) | Put the line "Card: k-spec #<n>" near its top. As soon as the file exists: `k-spec link <n> <path> "Design"` (or "Plan", or what it is). Only markdown inside the project folder can be attached; say so when you skip a file. |
| You write the plan | Put the board steps into the plan itself (next section). |
| The build stops for the user | `k-spec status <n> waiting` (a blocker: `blocked`), and `k-spec status <n> working` when it goes on. |
| The build and its final review are finished | `k-spec move <n> Done`, `k-spec status <n> idle`, `k-spec end <n>`. |

### The board steps in the plan

A plan is carried out long after it was written, perhaps by a subagent that sees one task and
nothing else. So the plan carries the board steps, as steps like any other. Add these four:

1. **Under Global Constraints** (at the top, in a plan that has none):

   ```
   Card: k-spec #<n>. The board command is <command>. A board command that fails never blocks
   the build: say so once, go on, and bring the board up to date when it answers again.
   ```

   `<command>` is the `k-spec` command of the checkout the build runs in. If that checkout has
   none (a git worktree made before `.k-spec/` was committed), write the main checkout's
   launcher with its full path: it works from any folder.

2. **As the first step of Task 1**, one line per task, numbered as in the plan:

   ```bash
   k-spec checklist <n> Plan - <<'EOF'
   1. <title of task 1>
   2. <title of task 2>
   EOF
   k-spec status <n> working
   k-spec move <n> "In Progress"
   k-spec start <n>
   ```

   When the build runs in a worktree: `k-spec start <n> --worktree <path>`.

3. **As the last step of every Task N**, after its commit: `k-spec check <n> Plan.<N>`.

4. **After the last task**, once the fixes of the final review are in: the three commands of
   the table's last row.

A task with no written plan gets the same milestones: a `Plan` checklist when there is more
than one step, `working` and In Progress at the start, a tick per step, Done at the end.

### Resuming

"resume", "continue #12", or a new session: `k-spec board --lane "In Progress"` shows what is
being worked, and `k-spec show <n> --activity` with the card's links gives the plan. Go on at
the first unticked item of `Plan`. If the plan's own record says more is done than the board
shows, tick to catch up.

### Rules of the workflow

- **The board never blocks the build.** A k-spec command that fails (the board is not running,
  a lane is not there) is said once in the chat. The work goes on, and the board is brought up
  to date when it answers again.
- **Lanes are found by name:** Backlog, In Progress, Done. If one is missing, show the lanes
  with `k-spec board` and ask once which to use. Never create or rename a lane.
- **No comments for progress.** The checklist and the status are the progress, and an agent's
  comment answers open requests. A task that started from a request follows "Handling a
  request" and replies once, at the end.
- **The dump is the user's to commit.** It changes with every change on the board. Stage files
  by name in every commit and leave the dump out, unless the user asks for the board to be
  committed.

## Never

- Never edit the board's dump (`data/k-spec.dump.json`, or `.k-spec/data/k-spec.dump.json` in a
  project set up with `k-spec init`) or the database file beside it. Change the board through
  the command only.
- Never print or commit `.k-spec/.env`: it holds the board's access token. Leave it and the
  other files `k-spec init` wrote (`.k-spec/compose.yaml`, `.k-spec/k-spec`) as they are.
- Never delete a card unless the user asked for that, and never move it to another lane unless
  the user asked: working a task on the board (above) is the user asking for those moves.
