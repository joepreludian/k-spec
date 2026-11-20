import { boardOpenRequests } from "@/domain/board.js";
import { ConnectionError, connectionTrouble } from "./connection.js";
import { formatTime, oneLine } from "./render.js";

/** How long `watch` waits between two looks at the board's version. */
export const WATCH_INTERVAL_MS = 2000;

/** How much of a request's text goes on its line; the rest is read with `show`. */
const BODY_LIMIT = 200;

// Whoever reads `watch` (Claude Code's Monitor) takes every line as one event, so text from the
// board must never be able to start a line: control characters go, and so does every other kind
// of white space that some reader could take for a line break.
const flat = (text) => oneLine(text).replace(/\s+/g, " ").trim();

function cut(text) {
  const characters = Array.from(text); // by character, so the cut never falls inside one
  return characters.length <= BODY_LIMIT ? text : `${characters.slice(0, BODY_LIMIT).join("").trimEnd()}…`;
}

/** The one line that announces an open request: enough to know which card to read. */
export function requestLine({ card, lane, comment }) {
  const where = `[${flat(lane.name)}, ${flat(card.agentStatus)}]`;
  const who = `${flat(comment.author.name)}, ${formatTime(comment.createdAt)}`;
  return `request #${card.number} ${flat(card.title)} ${where} ${who}: ${cut(flat(comment.body))}`;
}

const requestEvent = ({ card, lane, comment }) => ({
  type: "request",
  number: card.number,
  title: card.title,
  lane: lane.name,
  status: card.agentStatus,
  author: comment.author.name,
  createdAt: comment.createdAt,
  body: comment.body,
  cardId: card.id,
  commentId: comment.id,
});

/**
 * Which kind of trouble an error is, as far as the reader cares: the server is `away` (not
 * answering, or its note is missing), it `rejected` the token, or something `unexpected` answered.
 */
function troubleKind(error) {
  if (error instanceof ConnectionError || error.reason === "unreachable") return "away";
  return error.reason === "rejected" ? "rejected" : "unexpected";
}

const plural = (n) => `${n} open request${n === 1 ? "" : "s"}`;

/**
 * Prints every open request, then each new one as it appears, until told to stop.
 *
 * Every round it asks for the board's version, and reads the board only when that changed (or
 * when it has just connected: a new database can repeat a version). A request is printed once
 * per run. Trouble that can heal (server away, note missing, token changed) is said on stdout,
 * because that is the only stream a monitor reads: once, and again only when it turns into
 * another kind of trouble (a server that comes back refusing the token must not look like one
 * that is still away). The next round works out the connection afresh. Trouble that cannot
 * heal is thrown.
 */
async function watch(ctx) {
  const emit = (event, line) => ctx.out(ctx.json ? JSON.stringify(event) : line);
  const printed = new Set();
  let link = null; // { url, api } while the server is answering
  let version = null;
  let connectedBefore = false;
  let said = null; // the kind of trouble last reported in this outage

  while (!ctx.signal.aborted) {
    let url;
    try {
      const current = link ?? ctx.connect();
      url = current.url;
      const seen = await current.api.getVersion();
      if (link === null || seen !== version) {
        const answer = await current.api.getBoard();
        const open = boardOpenRequests(answer.board);
        if (link === null && connectedBefore) emit({ type: "connected", url }, `k-spec: connected to ${url}`);
        if (link === null && !connectedBefore) {
          const event = { type: "watching", board: answer.board.name, url, open: open.length };
          emit(event, `watching ${flat(answer.board.name)} at ${url}, ${plural(open.length)}`);
        }
        for (const entry of open) {
          if (printed.has(entry.comment.id)) continue;
          printed.add(entry.comment.id);
          emit(requestEvent(entry), requestLine(entry));
        }
        version = answer.version;
        link = current;
        connectedBefore = true;
        said = null;
      }
    } catch (error) {
      if (ctx.signal.aborted) break; // stopped in the middle of a request: not an outage
      const reason = connectionTrouble(error, url);
      if (reason === null || (error instanceof ConnectionError && !error.transient)) throw error;
      const kind = troubleKind(error);
      if (kind !== said) emit({ type: "disconnected", reason }, `k-spec: ${flat(reason)}`);
      said = kind;
      link = null;
    }
    await ctx.sleep(WATCH_INTERVAL_MS);
  }
}

/** The command that waits. `lazy`: it connects by itself, again after every outage. */
export const WATCH_COMMANDS = {
  watch: {
    usage: "watch",
    summary: "print every open request to the agent, one line each, now and as they arrive; runs until stopped",
    options: {},
    arity: [0, 0],
    lazy: true,
    run: (ctx) => watch(ctx),
  },
};
