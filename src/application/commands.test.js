import { COMMANDS, COMMAND_NAMES } from "./commands.js";

const SPEC_NAMES = [
  "getBoard", "createLane", "renameLane", "removeLane", "reorderLanes",
  "createCard", "updateCardTitle", "updateCardDescription", "moveCard", "deleteCard", "setAgentStatus",
  "createLabel", "updateLabel", "deleteLabel", "addLabel", "removeLabel",
  "addChecklist", "removeChecklist", "addChecklistItem", "toggleChecklistItem", "removeChecklistItem",
  "addComment", "addCardLink", "removeCardLink", "startWork", "updateWorkSession", "endWork", "setProject",
];

test("registry has exactly the spec command names", () => {
  expect([...COMMAND_NAMES].sort()).toEqual([...SPEC_NAMES].sort());
  expect(Object.isFrozen(COMMANDS)).toBe(true);
});

test("every command is a function", () => {
  for (const name of COMMAND_NAMES) expect(typeof COMMANDS[name]).toBe("function");
});
