import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardDialog } from "./CardDialog.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { removeCard } from "@/domain/board.js";

const board = seedBoard(); // card-2 "Board domain model" in Review, waiting-for-input

test("opens with card title, lane and status", async () => {
  renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Board domain model" })).toBeInTheDocument();
  expect(within(dialog).getByText(/in Review/)).toBeInTheDocument();
  expect(within(dialog).getByRole("combobox", { name: "Agent status" })).toHaveTextContent("Waiting for input");
});

test("renders nothing when cardId is null", () => {
  renderWithBoard(<CardDialog cardId={null} onClose={vi.fn()} />, board);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("editing the title dispatches updateCardTitle", async () => {
  const { executor } = renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("heading", { name: "Board domain model" }));
  const input = within(dialog).getByLabelText("Card title");
  await userEvent.clear(input);
  await userEvent.type(input, "Domain model v2{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("updateCardTitle", { cardId: "card-2", title: "Domain model v2" });
});

test("changing status dispatches setAgentStatus", async () => {
  const { executor } = renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent status" }));
  await userEvent.click(await screen.findByRole("option", { name: "Blocked" }));
  expect(executor.execute).toHaveBeenCalledWith("setAgentStatus", { cardId: "card-2", status: "blocked" });
});

test("delete confirms then dispatches deleteCard and closes", async () => {
  const onClose = vi.fn();
  const executor = { execute: vi.fn().mockResolvedValue({ board: removeCard(board, "card-2") }) };
  renderWithBoard(<CardDialog cardId="card-2" onClose={onClose} />, board, { executor });
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete card" }));
  const confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
  expect(executor.execute).toHaveBeenCalledWith("deleteCard", { cardId: "card-2" });
  expect(onClose).toHaveBeenCalled();
});

test("closing via the dialog calls onClose", async () => {
  const onClose = vi.fn();
  renderWithBoard(<CardDialog cardId="card-2" onClose={onClose} />, board);
  await screen.findByRole("dialog");
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});

test("shows labels and the labels editor, description editor and delete", async () => {
  renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("spec")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Edit labels" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Delete card" })).toBeInTheDocument();
});
