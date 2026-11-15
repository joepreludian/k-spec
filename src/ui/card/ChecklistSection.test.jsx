import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChecklistSection } from "./ChecklistSection.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const board = seedBoard();
// card-2 has checklist "Acceptance" (checklist-1) with items: item-1 done, item-2 done, item-3 open
const card = findCard(board, "card-2").card;
const bare = findCard(board, "card-8").card;

const list = (name) => screen.getByRole("group", { name });

test("renders checklists with items, checked state and progress", () => {
  renderWithBoard(<ChecklistSection card={card} />, board);
  const acceptance = list("Acceptance");
  expect(within(acceptance).getByRole("checkbox", { name: "moveCard clamps positions" })).toBeChecked();
  expect(within(acceptance).getByRole("checkbox", { name: "round-trips to frontmatter" })).not.toBeChecked();
  expect(within(acceptance).getByText("2/3")).toBeInTheDocument();
  expect(within(acceptance).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
});

test("toggling an item dispatches toggleChecklistItem", async () => {
  const { executor } = renderWithBoard(<ChecklistSection card={card} />, board);
  await userEvent.click(within(list("Acceptance")).getByRole("checkbox", { name: "round-trips to frontmatter" }));
  expect(executor.execute).toHaveBeenCalledWith("toggleChecklistItem", {
    cardId: "card-2",
    checklistId: "checklist-1",
    itemId: "item-3",
  });
});

test("adding an item dispatches addChecklistItem and clears the input", async () => {
  const { executor } = renderWithBoard(<ChecklistSection card={card} />, board);
  const input = within(list("Acceptance")).getByLabelText("Add an item");
  await userEvent.type(input, "ship it{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("addChecklistItem", {
    cardId: "card-2",
    checklistId: "checklist-1",
    text: "ship it",
  });
  expect(input).toHaveValue("");
});

test("removing an item dispatches removeChecklistItem", async () => {
  const { executor } = renderWithBoard(<ChecklistSection card={card} />, board);
  await userEvent.click(within(list("Acceptance")).getByRole("button", { name: "Remove item moveCard clamps positions" }));
  expect(executor.execute).toHaveBeenCalledWith("removeChecklistItem", {
    cardId: "card-2",
    checklistId: "checklist-1",
    itemId: "item-1",
  });
});

test("deleting a checklist dispatches removeChecklist", async () => {
  const { executor } = renderWithBoard(<ChecklistSection card={card} />, board);
  await userEvent.click(within(list("Acceptance")).getByRole("button", { name: "Checklist menu" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Delete checklist" }));
  expect(executor.execute).toHaveBeenCalledWith("removeChecklist", { cardId: "card-2", checklistId: "checklist-1" });
});

test("adding a checklist dispatches addChecklist", async () => {
  const { executor } = renderWithBoard(<ChecklistSection card={bare} />, board);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "+ Checklist" }));
  await userEvent.type(screen.getByLabelText("Checklist title"), "QA{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("addChecklist", { cardId: "card-8", title: "QA" });
});
