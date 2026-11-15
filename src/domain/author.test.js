import { AUTHOR_KINDS, PERSON, createAuthor } from "./author.js";
import { InvalidAuthor } from "./errors.js";

test("PERSON is You", () => {
  expect(PERSON).toEqual({ kind: "person", name: "You" });
  expect(Object.isFrozen(PERSON)).toBe(true);
});

test("kinds are person and agent", () => {
  expect(AUTHOR_KINDS).toEqual(["person", "agent"]);
});

test("agent author keeps trimmed name", () => {
  expect(createAuthor({ kind: "agent", name: " claude " })).toEqual({
    kind: "agent",
    name: "claude",
  });
});

test("rejects bad kind or empty name", () => {
  expect(() => createAuthor({ kind: "bot", name: "x" })).toThrow(InvalidAuthor);
  expect(() => createAuthor({ kind: "agent", name: "  " })).toThrow(
    InvalidAuthor,
  );
  expect(() => createAuthor(undefined)).toThrow(InvalidAuthor);
});
