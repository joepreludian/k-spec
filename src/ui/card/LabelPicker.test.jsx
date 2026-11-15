import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelPicker } from "./LabelPicker.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const board = seedBoard();
const card = findCard(board, "card-2").card; // labelIds: ["label-spec"]

async function openPicker() {
  await userEvent.click(screen.getByRole("button", { name: "Edit labels" }));
  return screen.findByRole("dialog", { name: "Labels" });
}

test("lists board labels with the card's labels checked", async () => {
  renderWithBoard(<LabelPicker card={card} />, board);
  const picker = await openPicker();
  expect(within(picker).getByRole("checkbox", { name: "spec" })).toBeChecked();
  expect(within(picker).getByRole("checkbox", { name: "bug" })).not.toBeChecked();
  expect(within(picker).getAllByRole("checkbox")).toHaveLength(board.labels.length);
});

test("toggling dispatches addLabel / removeLabel", async () => {
  const { executor } = renderWithBoard(<LabelPicker card={card} />, board);
  const picker = await openPicker();
  await userEvent.click(within(picker).getByRole("checkbox", { name: "bug" }));
  expect(executor.execute).toHaveBeenCalledWith("addLabel", { cardId: "card-2", labelId: "label-bug" });
  await userEvent.click(within(picker).getByRole("checkbox", { name: "spec" }));
  expect(executor.execute).toHaveBeenCalledWith("removeLabel", { cardId: "card-2", labelId: "label-spec" });
});

test("creating a label dispatches createLabel then addLabel with the returned id", async () => {
  const executor = {
    execute: vi.fn(async (name) => (name === "createLabel" ? { board, id: "l-new" } : { board })),
  };
  renderWithBoard(<LabelPicker card={card} />, board, { executor });
  const picker = await openPicker();
  await userEvent.type(within(picker).getByLabelText("New label name"), "docs");
  await userEvent.click(within(picker).getByRole("radio", { name: "violet" }));
  await userEvent.click(within(picker).getByRole("button", { name: "Create label" }));
  expect(executor.execute).toHaveBeenCalledWith("createLabel", { name: "docs", color: "violet" });
  expect(executor.execute).toHaveBeenLastCalledWith("addLabel", { cardId: "card-2", labelId: "l-new" });
});

test("editing an existing label dispatches updateLabel and deleteLabel", async () => {
  const { executor } = renderWithBoard(<LabelPicker card={card} />, board);
  const picker = await openPicker();
  await userEvent.click(within(picker).getByRole("button", { name: "Edit label bug" }));
  const nameInput = within(picker).getByLabelText("Label name");
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "defect");
  await userEvent.click(within(picker).getByRole("radio", { name: "orange" }));
  await userEvent.click(within(picker).getByRole("button", { name: "Save" }));
  expect(executor.execute).toHaveBeenCalledWith("updateLabel", { labelId: "label-bug", name: "defect", color: "orange" });

  await userEvent.click(within(picker).getByRole("button", { name: "Edit label ui" }));
  await userEvent.click(within(picker).getByRole("button", { name: "Delete" }));
  expect(executor.execute).toHaveBeenCalledWith("deleteLabel", { labelId: "label-ui" });
});
