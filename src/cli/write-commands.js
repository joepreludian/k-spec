import {
  cardByNumber,
  checklistItemAt,
  laneByName,
  normalizeStatus,
  parseCardNumber,
  serviceByTitle,
} from "@/application/board-lookup.js";
import { DomainError } from "@/domain/errors.js";
import { UsageError } from "./errors.js";
import { oneLine } from "./render.js";

const pretty = (value) => JSON.stringify(value, null, 2);
const withoutBoard = (answer) => Object.fromEntries(Object.entries(answer).filter(([key]) => key !== "board"));

/** `-` means "read it from stdin": the one newline a shell adds at the end is dropped, nothing else. */
async function textOf(word, readStdin) {
  return word === "-" ? (await readStdin()).replace(/\r?\n$/, "") : word;
}

/** The card `<n>` names, on the board as the server has it now. */
async function findCard(api, word) {
  const number = parseCardNumber(word);
  const { board } = await api.getBoard();
  return { board, number, ...cardByNumber(board, number) };
}

/** Prints the one-line confirmation, or with --json the server's answer without the board. */
function report({ out, json }, line, answer) {
  out(json ? pretty(withoutBoard(answer)) : oneLine(line));
}

function agentAuthor(values, env) {
  if (values.agent !== undefined && values.agent.trim() === "") throw new UsageError("--agent needs a name");
  const name = (values.agent ?? env.K_SPEC_AGENT ?? "").trim();
  return name ? { kind: "agent", name } : null;
}

function parseLocation(text, hostname) {
  if (text === undefined) return { kind: "host", name: hostname() };
  const at = text.indexOf(":");
  const kind = at < 0 ? "" : text.slice(0, at).trim();
  const name = at < 0 ? "" : text.slice(at + 1).trim();
  if (!kind || !name) throw new UsageError("location must be <kind>:<name>, e.g. host:laptop");
  return { kind, name };
}

function parseInput(text) {
  try {
    const input = JSON.parse(text);
    if (typeof input === "object" && input !== null && !Array.isArray(input)) return input;
  } catch {
    // reported below
  }
  throw new UsageError("input must be a JSON object");
}

const tick = (wanted) => ({
  usage: `${wanted ? "check" : "uncheck"} <n> <item>`,
  summary: `${wanted ? "tick" : "untick"} a checklist item: the c.i number show prints (e.g. 1.2), or <checklist title>.<i>`,
  options: {},
  arity: [2, 2],
  async run(ctx, { positionals: [n, ref] }) {
    const { card, number } = await findCard(ctx.api, n);
    const { checklist, item } = checklistItemAt(card, ref);
    const state = wanted ? "checked" : "unchecked";
    if (item.done === wanted) return report(ctx, `#${number} ${ref} already ${state}`, { changed: false });
    const answer = await ctx.api.execute("toggleChecklistItem", { cardId: card.id, checklistId: checklist.id, itemId: item.id });
    return report(ctx, `#${number} ${ref} ${state}`, answer);
  },
});

/** Commands that change the board. Each resolves what was typed against the board, then posts one command. */
export const WRITE_COMMANDS = {
  comment: {
    usage: "comment <n> <text> [--agent <name>] [--request]",
    summary: "add a comment (- reads stdin); yours unless --agent or K_SPEC_AGENT names an agent; --request sends it to the agent",
    options: { agent: { type: "string" }, request: { type: "boolean" } },
    arity: [2, 2],
    async run(ctx, { positionals: [n, word], values }) {
      const author = agentAuthor(values, ctx.env);
      const request = values.request === true;
      if (request && author) throw new UsageError("an agent cannot send a request");
      const body = await textOf(word, ctx.readStdin);
      const { card, number } = await findCard(ctx.api, n);
      const input = { cardId: card.id, body, ...(author ? { author } : {}), ...(request ? { request: true } : {}) };
      report(ctx, request ? `#${number} request sent` : `#${number} comment added`, await ctx.api.execute("addComment", input));
    },
  },
  status: {
    usage: "status <n> <status>",
    summary: "set the agent status: idle, working, waiting (waiting-for-input), blocked",
    options: {},
    arity: [2, 2],
    async run(ctx, { positionals: [n, word] }) {
      const status = normalizeStatus(word);
      const { card, number } = await findCard(ctx.api, n);
      report(ctx, `#${number} status ${status}`, await ctx.api.execute("setAgentStatus", { cardId: card.id, status }));
    },
  },
  move: {
    usage: "move <n> <lane> [--top]",
    summary: "move the card to the end of a lane, or its top",
    options: { top: { type: "boolean" } },
    arity: [2, 2],
    async run(ctx, { positionals: [n, laneName], values }) {
      const { board, card, number } = await findCard(ctx.api, n);
      const lane = laneByName(board, laneName);
      const input = { cardId: card.id, toLaneId: lane.id, ...(values.top ? { position: 0 } : {}) };
      report(ctx, `#${number} moved to ${lane.name}`, await ctx.api.execute("moveCard", input));
    },
  },
  check: tick(true),
  uncheck: tick(false),
  checklist: {
    usage: "checklist <n> <title> [<item>...]",
    summary: "add a checklist with its items to the card (a single - reads the items from stdin, one per line)",
    options: {},
    arity: [2, Infinity],
    async run(ctx, { positionals: [n, title, ...words] }) {
      const fromStdin = words.length === 1 && words[0] === "-";
      const items = fromStdin ? (await ctx.readStdin()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : words;
      const { card, number } = await findCard(ctx.api, n);
      const created = await ctx.api.execute("addChecklist", { cardId: card.id, title });
      const checklists = cardByNumber(created.board, number).card.checklists;
      const position = checklists.findIndex((entry) => entry.id === created.id) + 1;
      const line = `#${number} checklist ${position} "${checklists[position - 1].title}" added`;
      const ids = [];
      let last = created;
      for (const text of items) {
        try {
          last = await ctx.api.execute("addChecklistItem", { cardId: card.id, checklistId: created.id, text });
        } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          throw new DomainError(`${line} with ${ids.length} of ${items.length} items; the next one was refused: ${error.message}`, error.code);
        }
        ids.push(last.id);
      }
      const count = items.length === 0 ? "no items" : items.length === 1 ? "1 item" : `${items.length} items`;
      report(ctx, `${line} (${count})`, { id: created.id, number: position, items: ids, version: last.version });
    },
  },
  add: {
    usage: "add <lane> <title> [--description <text>]",
    summary: "create a card at the end of a lane (- reads the description from stdin)",
    options: { description: { type: "string" } },
    arity: [2, 2],
    async run(ctx, { positionals: [laneName, title], values }) {
      const description = values.description === undefined ? null : await textOf(values.description, ctx.readStdin);
      const { board } = await ctx.api.getBoard();
      const lane = laneByName(board, laneName);
      const created = await ctx.api.execute("createCard", { laneId: lane.id, title });
      const { number } = created.board.lanes.flatMap((l) => l.cards).find((card) => card.id === created.id);
      const line = `#${number} created in ${lane.name}`;
      let last = created;
      if (description !== null) {
        try {
          last = await ctx.api.execute("updateCardDescription", { cardId: created.id, description });
        } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          throw new DomainError(`${line}, but its description was refused: ${error.message}`, error.code);
        }
      }
      report(ctx, line, { id: created.id, number, version: last.version });
    },
  },
  delete: {
    usage: "delete <n>",
    summary: "delete the card (no confirmation)",
    options: {},
    arity: [1, 1],
    async run(ctx, { positionals: [n] }) {
      const { card, number } = await findCard(ctx.api, n);
      report(ctx, `#${number} deleted: ${card.title}`, await ctx.api.execute("deleteCard", { cardId: card.id }));
    },
  },
  start: {
    usage: "start <n> [--branch <b>] [--location <kind>:<name>] [--worktree <path>]",
    summary: "start work on the card (default: the current git branch, host:<this machine>)",
    options: { branch: { type: "string" }, location: { type: "string" }, worktree: { type: "string" } },
    arity: [1, 1],
    async run(ctx, { positionals: [n], values }) {
      const location = parseLocation(values.location, ctx.hostname);
      const branch = values.branch ?? ctx.gitBranch();
      if (!branch) throw new UsageError("no git branch here; pass --branch <name>");
      const { card, number } = await findCard(ctx.api, n);
      const input = { cardId: card.id, location, branch, worktreePath: values.worktree ?? null, session: null };
      report(ctx, `#${number} work started on ${branch}`, await ctx.api.execute("startWork", input));
    },
  },
  end: {
    usage: "end <n>",
    summary: "end the work on the card",
    options: {},
    arity: [1, 1],
    async run(ctx, { positionals: [n] }) {
      const { card, number } = await findCard(ctx.api, n);
      report(ctx, `#${number} work ended`, await ctx.api.execute("endWork", { cardId: card.id }));
    },
  },
  link: {
    usage: "link <n> <path> [<title>]",
    summary: "attach a markdown file of the project to the card; the title defaults to the file's name",
    options: {},
    arity: [2, 3],
    async run(ctx, { positionals: [n, path, title] }) {
      const { card, number } = await findCard(ctx.api, n);
      const input = { cardId: card.id, title: title ?? path.split("/").filter(Boolean).at(-1) ?? path, path };
      report(ctx, `#${number} linked ${path}`, await ctx.api.execute("addCardLink", input));
    },
  },
  publish: {
    usage: "publish <n> <title> <url>",
    summary: "publish a service (a link) on the card's active work",
    options: {},
    arity: [3, 3],
    async run(ctx, { positionals: [n, title, url] }) {
      const { card, number } = await findCard(ctx.api, n);
      report(ctx, `#${number} published ${title}`, await ctx.api.execute("publishService", { cardId: card.id, title, url }));
    },
  },
  unpublish: {
    usage: "unpublish <n> <title>",
    summary: "remove a published service, by its title",
    options: {},
    arity: [2, 2],
    async run(ctx, { positionals: [n, title] }) {
      const { card, number } = await findCard(ctx.api, n);
      const service = serviceByTitle(card, title);
      const answer = await ctx.api.execute("unpublishService", { cardId: card.id, serviceId: service.id });
      report(ctx, `#${number} unpublished ${service.title}`, answer);
    },
  },
  run: {
    usage: "run <command> [<json>] [--board]",
    summary: "any other command with raw ids, input as a JSON object (- reads stdin); prints the answer",
    options: { board: { type: "boolean" } },
    arity: [1, 2],
    async run(ctx, { positionals: [name, word = "{}"], values }) {
      if (name === "getBoard") throw new UsageError("getBoard is not a command; use k-spec board --json");
      const input = parseInput(await textOf(word, ctx.readStdin));
      let answer;
      try {
        answer = await ctx.api.execute(name, input);
      } catch (error) {
        if (error.reason === "unknown-command") throw new UsageError(`unknown command: ${name}`);
        throw error;
      }
      ctx.out(pretty(values.board ? answer : withoutBoard(answer)));
    },
  },
};
