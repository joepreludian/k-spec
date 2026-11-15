import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardTile } from "./CardTile.jsx";
import { createCard, addChecklist, addChecklistItem, toggleChecklistItem, addComment, setAgentStatus, addLabelToCard, startWork } from "@/domain/card.js";
import { PERSON } from "@/domain/author.js";

const T = "2026-11-14T10:00:00.000Z";
const labels = [
  { id: "l1", name: "bug", color: "red" },
  { id: "l2", name: "ui", color: "teal" },
];

function cardWithEverything() {
  let c = createCard({ id: "c1", number: 3, title: "File watcher", now: T });
  c = startWork(c, { location: { kind: "lima", name: "lima-dev" }, branch: "feat/watcher" }, T);
  c = addLabelToCard(c, "l1", T);
  c = addLabelToCard(c, "missing", T);
  c = setAgentStatus(c, "working", T);
  c = addChecklist(c, { id: "k1", title: "Steps" }, T);
  c = addChecklistItem(c, "k1", { id: "i1", text: "a" }, T);
  c = addChecklistItem(c, "k1", { id: "i2", text: "b" }, T);
  c = addChecklistItem(c, "k1", { id: "i3", text: "c" }, T);
  c = toggleChecklistItem(c, "k1", "i1", T);
  c = addComment(c, { id: "m1", author: PERSON, body: "x" }, T);
  c = addComment(c, { id: "m2", author: PERSON, body: "y" }, T);
  return c;
}

test("shows title, labels, status, progress and comment count", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  expect(screen.getByText("File watcher")).toBeInTheDocument();
  expect(screen.getByText("bug")).toBeInTheDocument();
  expect(screen.queryByText("ui")).not.toBeInTheDocument();
  expect(screen.getByText("working")).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByLabelText("2 comments")).toBeInTheDocument();
});

test("hides progress and comments when none", () => {
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={vi.fn()} />);
  expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/comments?$/)).not.toBeInTheDocument();
});

test("clicking the tile calls onOpen with the card id", async () => {
  const onOpen = vi.fn();
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={onOpen} />);
  await userEvent.click(screen.getByRole("button", { name: /Bare/ }));
  expect(onOpen).toHaveBeenCalledWith("c1");
});

test("shows #number before the title and labels after it", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  const number = screen.getByText("#3");
  const title = screen.getByText("File watcher");
  const label = screen.getByText("bug");
  expect(number.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(title.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("button", { name: /#3 File watcher/ })).toBeInTheDocument();
});

test("shows where the card is being worked and the total progress", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  expect(screen.getByText("lima")).toHaveAttribute("title", "lima-dev");
  expect(screen.getByText("feat/watcher")).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByLabelText("Steps 1/3")).toBeInTheDocument();
});

test("hides the where-line without work", () => {
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={vi.fn()} />);
  expect(screen.queryByText(/^(lima|worktree|host)$/)).not.toBeInTheDocument();
});

test("the checklist count carries an icon and a spoken label, like comments", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  const count = screen.getByLabelText("1 of 3 checklist items done");
  expect(count).toHaveTextContent("1/3");
  expect(count.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
