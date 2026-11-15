import { InvalidAuthor } from "./errors.js";

export const AUTHOR_KINDS = Object.freeze(["person", "agent"]);

export const PERSON = Object.freeze({ kind: "person", name: "You" });

export function createAuthor(input) {
  if (!input || !AUTHOR_KINDS.includes(input.kind)) throw new InvalidAuthor();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length === 0) throw new InvalidAuthor();
  return Object.freeze({ kind: input.kind, name });
}
