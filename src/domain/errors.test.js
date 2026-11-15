import {
  DomainError,
  LaneNotFound,
  CardNotFound,
  LabelNotFound,
  ChecklistNotFound,
  ChecklistItemNotFound,
  InvalidAgentStatus,
  EmptyTitle,
  EmptyText,
  LaneNotEmpty,
  DuplicateLabelName,
  InvalidLabelColor,
  InvalidLaneOrder,
  InvalidAuthor,
} from "./errors.js";

test("subclasses carry code and name", () => {
  const e = new LaneNotFound("abc");
  expect(e).toBeInstanceOf(DomainError);
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe("LANE_NOT_FOUND");
  expect(e.name).toBe("LaneNotFound");
  expect(e.message).toContain("abc");
});

test.each([
  [CardNotFound, "CARD_NOT_FOUND"],
  [LabelNotFound, "LABEL_NOT_FOUND"],
  [ChecklistNotFound, "CHECKLIST_NOT_FOUND"],
  [ChecklistItemNotFound, "CHECKLIST_ITEM_NOT_FOUND"],
  [InvalidAgentStatus, "INVALID_AGENT_STATUS"],
  [EmptyTitle, "EMPTY_TITLE"],
  [EmptyText, "EMPTY_TEXT"],
  [LaneNotEmpty, "LANE_NOT_EMPTY"],
  [DuplicateLabelName, "DUPLICATE_LABEL_NAME"],
  [InvalidLabelColor, "INVALID_LABEL_COLOR"],
  [InvalidLaneOrder, "INVALID_LANE_ORDER"],
  [InvalidAuthor, "INVALID_AUTHOR"],
])("%p has code %s and a default message", (Cls, code) => {
  const e = new Cls();
  expect(e).toBeInstanceOf(DomainError);
  expect(e.code).toBe(code);
  expect(e.name).toBe(Cls.name);
  expect(e.message.length).toBeGreaterThan(0);
});
