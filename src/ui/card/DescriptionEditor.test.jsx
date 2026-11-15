import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DescriptionEditor } from "./DescriptionEditor.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const board = seedBoard();
const card = findCard(board, "card-2").card; // has a markdown description
const bare = findCard(board, "card-8").card; // no description

test("renders the description as markdown", () => {
  renderWithBoard(<DescriptionEditor card={{ ...card, description: "# Goal\n\n- one\n- two" }} />, board);
  expect(screen.getByRole("heading", { name: "Goal" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("shows a placeholder when empty", () => {
  renderWithBoard(<DescriptionEditor card={bare} />, board);
  expect(screen.getByText(/add a description/i)).toBeInTheDocument();
});

test("edit then save dispatches updateCardDescription", async () => {
  const { executor } = renderWithBoard(<DescriptionEditor card={bare} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  await userEvent.type(screen.getByLabelText("Description"), "# Goal");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(executor.execute).toHaveBeenCalledWith("updateCardDescription", { cardId: "card-8", description: "# Goal" });
});

test("cancel discards the draft without dispatch", async () => {
  const { executor } = renderWithBoard(<DescriptionEditor card={bare} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  await userEvent.type(screen.getByLabelText("Description"), "junk");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(executor.execute).not.toHaveBeenCalled();
  expect(screen.getByText(/add a description/i)).toBeInTheDocument();
});
