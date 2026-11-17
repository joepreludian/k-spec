import { stringify } from "yaml";
import { DEFAULT_AGENT_STATUS } from "@/domain/agent-status.js";
import { LANES, slugify, toSnake } from "./format.js";

const yaml = (value) => stringify(value, { lineWidth: 0 });

/** Drops keys whose value is undefined, null, "" or an empty list. */
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  );

function folderOf(lane) {
  const known = LANES.find((l) => l.id === lane.id);
  if (!known) throw new Error(`Lane ${lane.id} is not one of the fixed lanes and cannot be written`);
  return known.folder;
}

/** `lanes/<folder>/<number>_<title slug>`: where a card lives, relative to the kspec root. */
export function cardDir(lane, card) {
  const slug = slugify(card.title);
  return `lanes/${folderOf(lane)}/${card.number}${slug ? `_${slug}` : ""}`;
}

const workToFile = ({ services, session, worktreePath, ...rest }) =>
  toSnake(
    compact({
      ...rest,
      worktreePath,
      session,
      services: services.map(({ title, url }) => ({ title, url })),
    }),
  );

function cardToFile(card, labelName) {
  return compact({
    title: card.title,
    description: card.description,
    labels: card.labelIds.map(labelName),
    agent_status: card.agentStatus === DEFAULT_AGENT_STATUS ? undefined : card.agentStatus,
    checklists: card.checklists.map((k) => ({
      title: k.title,
      items: k.items.map(({ text, done }) => ({ text, done })),
    })),
    comments: card.comments.map((c) => ({
      author: { kind: c.author.kind, name: c.author.name },
      at: c.createdAt,
      body: c.body,
    })),
    work: card.work ? workToFile(card.work) : undefined,
    work_history: card.workHistory.map(workToFile),
    events: card.events.map(toSnake),
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  });
}

/**
 * The board as kspec-root file contents: `{ "board.yaml": "…", "lanes/todo/cards.yaml": "…", … }`.
 * Ids are not written (the reader rebuilds them) and neither are card links (those are the
 * files in a card's `files/` folder).
 */
export function boardToFiles(board) {
  const labelName = (id) => board.labels.find((l) => l.id === id)?.name;
  const files = {
    "board.yaml": yaml({
      name: board.name,
      next_card_number: board.nextCardNumber,
      ...compact({
        project: board.project.name
          ? compact({
              name: board.project.name,
              readme: board.project.readmePath,
              links: board.project.links.map(({ title, url }) => ({ title, url })),
            })
          : undefined,
        labels: board.labels.map(({ name, color }) => ({ name, color })),
      }),
      preferences: {},
    }),
  };
  for (const lane of board.lanes) {
    files[`lanes/${folderOf(lane)}/cards.yaml`] = yaml({ order: lane.cards.map((c) => c.number) });
    for (const card of lane.cards) {
      files[`${cardDir(lane, card)}/card.yaml`] = yaml(cardToFile(card, labelName));
    }
  }
  return files;
}
