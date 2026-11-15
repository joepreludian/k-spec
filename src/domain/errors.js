export class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

const describe = (subject, fallback) => (id) =>
  id ? `${subject} "${id}" ${fallback}` : `${subject} ${fallback}`;

export class LaneNotFound extends DomainError {
  constructor(id) {
    super(describe("Lane", "not found")(id), "LANE_NOT_FOUND");
  }
}
export class CardNotFound extends DomainError {
  constructor(id) {
    super(describe("Card", "not found")(id), "CARD_NOT_FOUND");
  }
}
export class LabelNotFound extends DomainError {
  constructor(id) {
    super(describe("Label", "not found")(id), "LABEL_NOT_FOUND");
  }
}
export class ChecklistNotFound extends DomainError {
  constructor(id) {
    super(describe("Checklist", "not found")(id), "CHECKLIST_NOT_FOUND");
  }
}
export class ChecklistItemNotFound extends DomainError {
  constructor(id) {
    super(describe("Checklist item", "not found")(id), "CHECKLIST_ITEM_NOT_FOUND");
  }
}
export class InvalidAgentStatus extends DomainError {
  constructor(value) {
    super(
      value ? `"${value}" is not a valid agent status` : "Invalid agent status",
      "INVALID_AGENT_STATUS",
    );
  }
}
export class EmptyTitle extends DomainError {
  constructor() {
    super("Title cannot be empty", "EMPTY_TITLE");
  }
}
export class EmptyText extends DomainError {
  constructor() {
    super("Text cannot be empty", "EMPTY_TEXT");
  }
}
export class LaneNotEmpty extends DomainError {
  constructor(id) {
    super(describe("Lane", "still has cards")(id), "LANE_NOT_EMPTY");
  }
}
export class DuplicateLabelName extends DomainError {
  constructor(name) {
    super(
      name
        ? `A label named "${name}" already exists`
        : "A label with that name already exists",
      "DUPLICATE_LABEL_NAME",
    );
  }
}
export class InvalidLabelColor extends DomainError {
  constructor(color) {
    super(
      color ? `"${color}" is not a valid label color` : "Invalid label color",
      "INVALID_LABEL_COLOR",
    );
  }
}
export class InvalidLaneOrder extends DomainError {
  constructor() {
    super("Lane order must list every lane exactly once", "INVALID_LANE_ORDER");
  }
}
export class InvalidAuthor extends DomainError {
  constructor() {
    super("Author must be a person or an agent with a name", "INVALID_AUTHOR");
  }
}
export class InvalidCardNumber extends DomainError {
  constructor() {
    super("Card number must be a positive integer", "INVALID_CARD_NUMBER");
  }
}
export class InvalidLinkPath extends DomainError {
  constructor(path) {
    super(
      typeof path === "string" && path.trim()
        ? `"${path.trim()}" is not a relative markdown file path`
        : "A link needs a relative markdown file path",
      "INVALID_LINK_PATH",
    );
  }
}
export class DuplicateLink extends DomainError {
  constructor(path) {
    super(path ? `"${path}" is already linked` : "That file is already linked", "DUPLICATE_LINK");
  }
}
export class LinkNotFound extends DomainError {
  constructor(id) {
    super(describe("Link", "not found")(id), "LINK_NOT_FOUND");
  }
}
