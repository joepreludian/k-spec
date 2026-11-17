import { parse } from "yaml";
import { assertAgentStatus, DEFAULT_AGENT_STATUS } from "@/domain/agent-status.js";
import { createAuthor } from "@/domain/author.js";
import { addLane, createBoard, createLabel, setProject } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { DomainError, EmptyText, EmptyTitle } from "@/domain/errors.js";
import { createService } from "@/domain/service.js";
import { requireNonEmpty } from "@/domain/text.js";
import { createWork } from "@/domain/work.js";
import {
  CARD_FILE_PREFIX,
  KspecFormatError,
  LANES,
  MARKDOWN_FILE,
  cardNumberOf,
  slugify,
  toCamel,
} from "./format.js";

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const absent = (v) => v === undefined || v === null;

/** A value of the wrong type is an error, never a silent default (which would drop data). */
const wrongShape = (key, expected) => new DomainError(`\`${key}\` must be ${expected}`);

function list(value, key) {
  if (absent(value)) return [];
  if (!Array.isArray(value)) throw wrongShape(key, "a list");
  return value;
}

function mapping(value, key) {
  if (!isPlainObject(value)) throw wrongShape(key, "a mapping of keys to values");
  return value;
}

const mappings = (value, key) => list(value, key).map((entry) => mapping(entry, `${key} entry`));

function optional(value, key, type) {
  if (absent(value)) return undefined;
  if (typeof value !== type) throw wrongShape(key, `a ${type}`);
  return value;
}
const text = (v, fallback) => (typeof v === "string" && v ? v : fallback);

/** Parses one YAML file that must hold a mapping (an empty file counts as an empty mapping). */
function parseMapping(source, file) {
  let value;
  try {
    value = parse(source);
  } catch (error) {
    throw new KspecFormatError(`Invalid YAML: ${error.message.split("\n")[0]}`, file);
  }
  if (value === null || value === undefined) return {};
  if (!isPlainObject(value)) throw new KspecFormatError("Expected a mapping of keys to values", file);
  return value;
}

/** Runs `fn`; a domain rule it breaks becomes a format error naming `file`. */
function inFile(file, fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof DomainError) throw new KspecFormatError(error.message, file);
    throw error;
  }
}

function readBoardFile(source) {
  const file = "board.yaml";
  const raw = source === null ? {} : parseMapping(source, file);
  return inFile(file, () => {
    let board = createBoard({ id: "board-1", name: text(raw.name, "k-spec") });
    if (!absent(raw.project)) {
      const project = mapping(raw.project, "project");
      board = setProject(board, {
        name: project.name,
        links: mappings(project.links, "project.links").map((l, i) => ({ id: `project-link-${i + 1}`, title: l.title, url: l.url })),
        readmePath: project.readme ?? null,
      });
    }
    for (const label of mappings(raw.labels, "labels")) {
      const slug = slugify(optional(label.name, "labels name", "string") ?? "");
      const clash = board.labels.find((l) => l.id === `label-${slug}`);
      if (clash) throw new DomainError(`Labels "${clash.name}" and "${label.name}" are too alike to tell apart`);
      if (label.name?.trim() && !slug) {
        throw new DomainError(`Label "${label.name}" needs at least one letter or digit (a-z, 0-9)`);
      }
      board = createLabel(board, { id: `label-${slug}`, name: label.name, color: label.color });
    }
    return { board, counter: Number.isInteger(raw.next_card_number) ? raw.next_card_number : 1 };
  });
}

function readOrder(source, file) {
  if (source === null) return [];
  const { order = [] } = parseMapping(source, file);
  if (!Array.isArray(order) || !order.every(Number.isInteger)) {
    throw new KspecFormatError("`order` must be a list of card numbers", file);
  }
  return order;
}

function buildWork(raw, { idPrefix, fallbackAt }) {
  const input = toCamel(mapping(raw, "work"));
  const startedAt = text(input?.startedAt, fallbackAt);
  const work = createWork({
    location: input?.location,
    branch: input?.branch,
    worktreePath: input?.worktreePath ?? null,
    session: input?.session ?? null,
    now: startedAt,
  });
  const services = mappings(input.services, "services").map((s, i) =>
    createService({ id: `${idPrefix}-service-${i + 1}`, title: s.title, url: s.url }),
  );
  return { ...work, services };
}

const WORK_EVENTS = ["work-started", "work-ended"];

/** Activity entries are rendered as they are, so each one is checked here. */
function buildEvent(raw) {
  const event = toCamel(mapping(raw, "events entry"));
  if (typeof event.at !== "string") throw wrongShape("events at", "a timestamp");
  if (event.type === "status-changed") {
    assertAgentStatus(event.to);
    if (typeof event.from !== "string") throw wrongShape("events from", "a status");
  } else if (WORK_EVENTS.includes(event.type)) {
    const location = mapping(event.location, "events location");
    if (typeof location.kind !== "string" || typeof location.name !== "string" || typeof event.branch !== "string") {
      throw new DomainError(`A ${event.type} event needs a location (kind, name) and a branch`);
    }
  } else {
    throw new DomainError(`Unknown event type "${event.type}"`);
  }
  return event;
}

function buildCard({ number, raw, modifiedAt, files, labelIdByName }) {
  const id = `card-${number}`;
  if (raw.number !== undefined && raw.number !== number) {
    throw new DomainError(`\`number: ${raw.number}\` does not match the folder's number ${number}`);
  }
  const createdAt = text(raw.created_at, modifiedAt);
  const updatedAt = text(raw.updated_at, modifiedAt);
  const base = createCard({ id, number, title: raw.title, now: createdAt });

  const labelIds = list(raw.labels, "labels").map((name) => {
    if (typeof name !== "string") throw wrongShape("labels", "a list of label names");
    const labelId = labelIdByName.get(name.toLowerCase());
    if (!labelId) throw new DomainError(`Label "${name}" is not defined in board.yaml`);
    return labelId;
  });

  const checklists = mappings(raw.checklists, "checklists").map((k, ki) => {
    const checklistId = `${id}-checklist-${ki + 1}`;
    return {
      id: checklistId,
      title: requireNonEmpty(k.title, EmptyTitle),
      items: mappings(k.items, "checklist items").map((item, ii) => ({
        id: `${checklistId}-item-${ii + 1}`,
        text: requireNonEmpty(item.text, EmptyText),
        done: optional(item.done, "done", "boolean") ?? false,
      })),
    };
  });

  const comments = mappings(raw.comments, "comments").map((c, i) => ({
    id: `${id}-comment-${i + 1}`,
    author: { ...createAuthor(c.author) },
    body: requireNonEmpty(c.body, EmptyText),
    createdAt: text(c.at, updatedAt),
  }));

  const links = files
    .filter((name) => MARKDOWN_FILE.test(name))
    .sort()
    .map((name) => ({
      id: `${id}-file-${name}`,
      title: name.replace(MARKDOWN_FILE, ""),
      path: `${CARD_FILE_PREFIX}/${number}/${name}`,
    }));

  return {
    ...base,
    description: optional(raw.description, "description", "string") ?? "",
    labelIds,
    agentStatus: assertAgentStatus(raw.agent_status ?? DEFAULT_AGENT_STATUS),
    checklists,
    comments,
    links,
    work: absent(raw.work) ? null : buildWork(raw.work, { idPrefix: id, fallbackAt: updatedAt }),
    workHistory: list(raw.work_history, "work_history").map((w, i) => ({
      ...buildWork(w, { idPrefix: `${id}-history-${i + 1}`, fallbackAt: createdAt }),
      endedAt: text(w?.ended_at, updatedAt),
    })),
    events: list(raw.events, "events").map(buildEvent),
    updatedAt,
  };
}

/**
 * Builds the domain board from the raw contents of a kspec root:
 * `{ boardYaml, lanes: { [folder]: { cardsYaml, cards: [{ dir, cardYaml, modifiedAt, files }] } } }`
 * (file texts, or null when a file is missing). Throws KspecFormatError naming the offending file.
 */
export function boardFromFiles(tree) {
  const { board: empty, counter } = readBoardFile(tree.boardYaml);
  const labelIdByName = new Map(empty.labels.map((l) => [l.name.toLowerCase(), l.id]));
  const seenIn = new Map();
  let highest = 0;
  let board = empty;

  for (const { folder, id, name } of LANES) {
    const lane = tree.lanes[folder] ?? { cardsYaml: null, cards: [] };
    const order = readOrder(lane.cardsYaml, `lanes/${folder}/cards.yaml`);
    const byNumber = new Map();

    for (const entry of lane.cards) {
      const number = cardNumberOf(entry.dir);
      if (number === null) continue;
      const dir = `lanes/${folder}/${entry.dir}`;
      const file = `${dir}/card.yaml`;
      if (seenIn.has(number)) {
        throw new KspecFormatError(`Card #${number} exists twice: ${seenIn.get(number)} and ${dir}`, file);
      }
      seenIn.set(number, dir);
      if (entry.cardYaml === null) throw new KspecFormatError("card.yaml is missing", file);
      const raw = parseMapping(entry.cardYaml, file);
      byNumber.set(
        number,
        inFile(file, () =>
          buildCard({ number, raw, modifiedAt: entry.modifiedAt, files: entry.files, labelIdByName }),
        ),
      );
      highest = Math.max(highest, number);
    }

    const listed = order.filter((n, i) => byNumber.has(n) && order.indexOf(n) === i);
    const rest = [...byNumber.keys()].filter((n) => !listed.includes(n)).sort((a, b) => a - b);
    board = addLane(board, { id, name, cards: [...listed, ...rest].map((n) => byNumber.get(n)) });
  }

  return { ...board, nextCardNumber: Math.max(counter, highest + 1, 1) };
}
