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

/** The item at `c.i` (checklist c, item i, both counted from 1, as `show` prints them). */
export function checklistItemAt(card, ref) {
  const match = /^([1-9]\d*)\.([1-9]\d*)$/.exec(ref);
  if (!match) {
    throw new LookupError(
      `Not an item number: ${ref} (use the c.i number from show, e.g. 1.2)`,
      "INVALID_REFERENCE",
    );
  }
  const checklist = card.checklists[Number(match[1]) - 1];
  const item = checklist?.items[Number(match[2]) - 1];
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
