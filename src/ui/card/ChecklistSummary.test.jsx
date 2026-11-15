import { render, screen } from "@testing-library/react";
import { ChecklistSummary } from "./ChecklistSummary.jsx";
import { createCard, addChecklist, addChecklistItem, toggleChecklistItem } from "@/domain/card.js";

const T = "2026-11-14T10:00:00.000Z";
const base = createCard({ id: "c", number: 1, title: "t", now: T });
function withList(c, id, title, items, done) {
  let next = addChecklist(c, { id, title }, T);
  for (let i = 0; i < items; i++) next = addChecklistItem(next, id, { id: `${id}-${i}`, text: "x" }, T);
  for (let i = 0; i < done; i++) next = toggleChecklistItem(next, id, `${id}-${i}`, T);
  return next;
}
const oneList = withList(base, "k1", "Steps", 3, 1);
const twoLists = withList(oneList, "k2", "Acceptance", 2, 2);

test("named rows plus All with two or more checklists", () => {
  render(<ChecklistSummary card={twoLists} />);
  expect(screen.getByText("Steps")).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByText("Acceptance")).toBeInTheDocument();
  expect(screen.getByText("2/2")).toBeInTheDocument();
  expect(screen.getByText("All")).toBeInTheDocument();
  expect(screen.getByText("3/5")).toBeInTheDocument();
  expect(screen.getAllByRole("progressbar")).toHaveLength(3);
});

test("no All row with a single checklist", () => {
  render(<ChecklistSummary card={oneList} />);
  expect(screen.getByText("Steps")).toBeInTheDocument();
  expect(screen.queryByText("All")).not.toBeInTheDocument();
});

test("renders nothing without checklists", () => {
  expect(render(<ChecklistSummary card={base} />).container).toBeEmptyDOMElement();
});
