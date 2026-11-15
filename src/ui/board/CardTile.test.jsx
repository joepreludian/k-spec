import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardTile } from "./CardTile.jsx";
import { createCard, addChecklist, addChecklistItem, toggleChecklistItem, addComment, setAgentStatus, addLabelToCard } from "@/domain/card.js";
import { PERSON } from "@/domain/author.js";

const T = "2026-11-14T10:00:00.000Z";
const labels = [
  { id: "l1", name: "bug", color: "red" },
  { id: "l2", name: "ui", color: "teal" },
];

function cardWithEverything() {
  let c = createCard({ id: "c1", title: "File watcher", now: T });
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
  render(<CardTile card={createCard({ id: "c1", title: "Bare", now: T })} labels={labels} onOpen={vi.fn()} />);
  expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/comments?$/)).not.toBeInTheDocument();
});

test("clicking the tile calls onOpen with the card id", async () => {
  const onOpen = vi.fn();
  render(<CardTile card={createCard({ id: "c1", title: "Bare", now: T })} labels={labels} onOpen={onOpen} />);
  await userEvent.click(screen.getByRole("button", { name: /Bare/ }));
  expect(onOpen).toHaveBeenCalledWith("c1");
});
