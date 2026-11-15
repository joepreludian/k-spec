import { getBoard } from "./use-cases/get-board.js";
import { createLane } from "./use-cases/create-lane.js";
import { renameLane } from "./use-cases/rename-lane.js";
import { removeLane } from "./use-cases/remove-lane.js";
import { reorderLanes } from "./use-cases/reorder-lanes.js";
import { createCard } from "./use-cases/create-card.js";
import { updateCardTitle } from "./use-cases/update-card-title.js";
import { updateCardDescription } from "./use-cases/update-card-description.js";
import { moveCard } from "./use-cases/move-card.js";
import { deleteCard } from "./use-cases/delete-card.js";
import { setAgentStatus } from "./use-cases/set-agent-status.js";
import { createLabel } from "./use-cases/create-label.js";
import { updateLabel } from "./use-cases/update-label.js";
import { deleteLabel } from "./use-cases/delete-label.js";
import { addLabel } from "./use-cases/add-label.js";
import { removeLabel } from "./use-cases/remove-label.js";
import { addChecklist } from "./use-cases/add-checklist.js";
import { removeChecklist } from "./use-cases/remove-checklist.js";
import { addChecklistItem } from "./use-cases/add-checklist-item.js";
import { toggleChecklistItem } from "./use-cases/toggle-checklist-item.js";
import { removeChecklistItem } from "./use-cases/remove-checklist-item.js";
import { addComment } from "./use-cases/add-comment.js";
import { addCardLink } from "./use-cases/add-card-link.js";
import { removeCardLink } from "./use-cases/remove-card-link.js";
import { startWork } from "./use-cases/start-work.js";
import { updateWorkSession } from "./use-cases/update-work-session.js";
import { endWork } from "./use-cases/end-work.js";
import { setProject } from "./use-cases/set-project.js";

/** Command name → use case. Every transport (local, HTTP, CLI) dispatches by these names. */
export const COMMANDS = Object.freeze({
  getBoard,
  createLane,
  renameLane,
  removeLane,
  reorderLanes,
  createCard,
  updateCardTitle,
  updateCardDescription,
  moveCard,
  deleteCard,
  setAgentStatus,
  createLabel,
  updateLabel,
  deleteLabel,
  addLabel,
  removeLabel,
  addChecklist,
  removeChecklist,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  addComment,
  addCardLink,
  removeCardLink,
  startWork,
  updateWorkSession,
  endWork,
  setProject,
});

export const COMMAND_NAMES = Object.freeze(Object.keys(COMMANDS));
