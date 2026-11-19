import { cardByNumber, parseCardNumber } from "@/application/board-lookup.js";
import { renderBoard, renderCard } from "./render.js";

const pretty = (value) => JSON.stringify(value, null, 2);

/** Commands that only look. Each: its usage line, a summary, its options, how many arguments, and `run(ctx, args)`. */
export const READ_COMMANDS = {
  board: {
    usage: "board [--lane <name>] [--status <status>]",
    summary: "lanes in order, one line per card (--json: the whole board, filters ignored)",
    options: { lane: { type: "string" }, status: { type: "string" } },
    arity: [0, 0],
    async run({ api, out, json }, { values }) {
      const answer = await api.getBoard();
      out(json ? pretty(answer) : renderBoard(answer, { lane: values.lane, status: values.status }));
    },
  },
  show: {
    usage: "show <n> [--activity]",
    summary: "one card in full; --activity adds its event log",
    options: { activity: { type: "boolean" } },
    arity: [1, 1],
    async run({ api, out, json }, { positionals, values }) {
      const number = parseCardNumber(positionals[0]);
      const { board } = await api.getBoard();
      const { card, lane } = cardByNumber(board, number);
      out(json ? pretty({ ...card, lane: lane.name }) : renderCard(board, card, lane, { activity: values.activity }));
    },
  },
};
