---
name: k-spec
description: Use when the user names a k-spec card or board ("k-spec #12", "card #12", "watch the board"), when a line starting with "request #" or "k-spec:" arrives from a k-spec watch monitor, or when work should be read from or recorded on the k-spec board. Covers reading a card, watching for requests sent from the board, and answering on the card with the k-spec CLI.
---

# k-spec: working with the board

k-spec is the user's kanban board. A card is a piece of work: its description is the spec, its
checklists say what "done" means, its comments are the conversation, its links are markdown files
in the project. The user works in the browser; you work through the `k-spec` command. The board is
a second source of truth: read the card instead of asking the user to repeat what is on it.

`k-spec help` lists every command. The command needs the k-spec server. If it answers
`error: server not running` or `server not answering`, tell the user; do not try to start,
restart or stop the server yourself.

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

Each line it prints is one event:

| Line starts with | Meaning | What to do |
|---|---|---|
| `watching` | The watch is running; the line says how many requests are open. | Nothing. |
| `request #<n>` | The user asked for something on card `<n>`. | Handle it (next section). |
| `k-spec:` | The watch lost or regained the server. | Nothing, unless the server stays away: then tell the user. |

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
5. Reply once on the card: `k-spec comment <n> "what you did, or your question" --agent Claude`.
   Use `-` as the text to read a long reply from stdin. Keep it short and point to files.
6. `k-spec status <n> waiting` if the user has to act (answer a question, approve something),
   otherwise `k-spec status <n> idle`.

Then say in the chat, in a line or two, what you did.

Rules that are easy to get wrong:

- **Do not acknowledge with a comment.** A request stays open until an agent comments on that
  card, and your first comment answers every open request on it. "I'm on it" is what the
  `working` status says. If you comment early and this session ends, nobody will be told the
  request was never done.
- **A question is a reply.** If you cannot proceed without the user, comment the question and set
  `waiting`. They answer with a new request.
- **One reply covers every open request on the card.** Read them all before replying.
- **A repeated line is not a new request.** Each time the watch starts it prints every request
  that is still open. If you are already working on one in this session, carry on.
- **Tick what you finish.** If the card has a checklist for the work, `k-spec check <n> <c.i>`
  as items get done (`show` prints the `c.i` numbers).

## Never

- Never edit `data/k-spec.dump.json` or the database file. Change the board through `k-spec` only.
- Never delete a card or move it to another lane unless the user asked for that.
