import { render, screen } from "@testing-library/react";
import { ChecklistSegments } from "./ChecklistSegments.jsx";
import { createCard, addChecklist, addChecklistItem, toggleChecklistItem } from "@/domain/card.js";

const T = "2026-11-14T10:00:00.000Z";

function card() {
  let c = createCard({ id: "c", number: 1, title: "t", now: T });
  c = addChecklist(c, { id: "k1", title: "Steps" }, T);
  for (const id of ["a", "b", "c"]) c = addChecklistItem(c, "k1", { id, text: id }, T);
  c = toggleChecklistItem(c, "k1", "a", T);
  c = addChecklist(c, { id: "k2", title: "Acceptance" }, T);
  for (const id of ["d", "e"]) c = addChecklistItem(c, "k2", { id, text: id }, T);
  c = toggleChecklistItem(toggleChecklistItem(c, "k2", "d", T), "k2", "e", T);
  return c;
}

test("one segment per checklist with a summary label", () => {
  render(<ChecklistSegments card={card()} />);
  const row = screen.getByLabelText("Steps 1/3 · Acceptance 2/2");
  expect(row).toHaveAttribute("title", "Steps 1/3 · Acceptance 2/2");
  const bars = row.querySelectorAll("[role=progressbar]");
  expect(bars).toHaveLength(2);
  expect(bars[0]).toHaveAttribute("aria-valuenow", "1");
  expect(bars[1]).toHaveAttribute("aria-valuenow", "2");
});

test("renders nothing without checklists", () => {
  const { container } = render(<ChecklistSegments card={createCard({ id: "c", number: 1, title: "t", now: T })} />);
  expect(container).toBeEmptyDOMElement();
});
