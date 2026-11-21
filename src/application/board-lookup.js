import { DomainError } from "@/domain/errors.js";

/** Something a person typed (a card number, a lane name, an item number, a service title) names nothing, or more than one thing. */
export class LookupError extends DomainError {
  constructor(message, code = "NOT_FOUND") {
    super(message, code);
    this.name = "LookupError";
  }
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const names = (list, key) => list.map((entry) => entry[key]).join(", ");

/** `"4"` or `"#4"` → 4. Anything else is refused rather than read as some other card. */
export function parseCardNumber(text) {
  const match = /^#?([1-9]\d*)$/.exec(text);
  if (!match) throw new LookupError(`Not a card number: ${text}`, "INVALID_REFERENCE");
  return Number(match[1]);
}

/** The card with that `#n` and the lane it is in. */
export function cardByNumber(board, number) {
  for (const lane of board.lanes) {
    const card = lane.cards.find((c) => c.number === number);
    if (card) return { card, lane };
  }
  throw new LookupError(`Card #${number} not found`);
}

/** The lane with that name: the whole name, ignoring case and surrounding spaces. */
export function laneByName(board, name) {
  const matches = board.lanes.filter((lane) => same(lane.name, name));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new LookupError(`Lane "${name}" not found (lanes: ${names(board.lanes, "name")})`);
  }
  throw new LookupError(`Lane "${name}" matches several lanes (${names(matches, "name")})`, "AMBIGUOUS");
}

/**
 * A checklist item of the card, named one of two ways: `c.i` (checklist c, item i, both counted
 * from 1, as `show` prints them), or `<checklist title>.<i>` (the whole title, ignoring case and
 * surrounding spaces, then the item's number in it). The title is everything before the last
 * dot. Digits before the dot always mean the checklist's number, also on a card that has a
 * checklist titled with a number. The second form is what a plan can write before the checklist
 * exists: it does not depend on how many checklists the card has by then.
 */
export function checklistItemAt(card, ref) {
  const invalid = () =>
    new LookupError(
      `Not an item: ${ref} (use the c.i number from show, e.g. 1.2, or <checklist title>.<i>)`,
      "INVALID_REFERENCE",
    );
  const dot = ref.lastIndexOf(".");
  if (dot < 0) throw invalid();
  const first = ref.slice(0, dot);
  const index = ref.slice(dot + 1);
  if (!/^[1-9]\d*$/.test(index)) throw invalid();
  let checklist;
  if (/^\s*\d+\s*$/.test(first)) {
    if (!/^[1-9]\d*$/.test(first)) throw invalid();
    checklist = card.checklists[Number(first) - 1];
  } else {
    const title = first.trim();
    if (!title) throw invalid();
    const matches = card.checklists.filter((entry) => same(entry.title, title));
    if (matches.length === 0) {
      throw new LookupError(`Checklist "${title}" not found on card #${card.number} (checklists: ${names(card.checklists, "title")})`);
    }
    if (matches.length > 1) {
      throw new LookupError(
        `Checklist "${title}" matches several checklists on card #${card.number} (use the c.i number from show)`,
        "AMBIGUOUS",
      );
    }
    [checklist] = matches;
  }
  const item = checklist?.items[Number(index) - 1];
  if (!item) throw new LookupError(`Card #${card.number} has no item ${ref}`);
  return { checklist, item };
}

/** The published service with that title on the card's active work. */
export function serviceByTitle(card, title) {
  if (!card.work) throw new LookupError(`Card #${card.number} has no active work`);
  const matches = card.work.services.filter((service) => same(service.title, title));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new LookupError(
      `Service "${title}" not found on card #${card.number} (services: ${names(card.work.services, "title")})`,
    );
  }
  throw new LookupError(
    `Service "${title}" matches several services on card #${card.number} (${names(matches, "title")})`,
    "AMBIGUOUS",
  );
}

/** `waiting` is accepted for `waiting-for-input`; the domain validates the rest. */
export function normalizeStatus(text) {
  return text === "waiting" ? "waiting-for-input" : text;
}
