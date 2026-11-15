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
  expect(within(dialog).getByText(/In Review/)).toBeInTheDocument();
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

test("header shows the number, lane, timestamps and where-chip", async () => {
  renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("#2")).toBeInTheDocument();
  expect(within(dialog).getByText(/^In Review · created .+ · updated .+$/)).toBeInTheDocument();
  expect(within(dialog).getByText("host")).toHaveAttribute("title", "jon-mbp");
  expect(within(dialog).getByText("host").parentElement).toHaveTextContent("main");
});

test("has four tabs with counts and starts on Overview with the execution strip", async () => {
  renderWithBoard(<CardDialog cardId="card-3" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  // card-3: 2 links; 1 comment + 4 events (status-changed, work-started, work-ended, work-started)
  expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Spec 2", "Execution", "Activity 5"]);
  expect(within(dialog).getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  expect(within(dialog).getByText("lima · lima-dev-k-spec-watcher")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(within(dialog).getAllByText("Steps").length).toBeGreaterThanOrEqual(2); // summary row + checklist heading
});

test("tabs without counts when there is nothing to count", async () => {
  renderWithBoard(<CardDialog cardId="card-8" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Spec", "Execution", "Activity"]);
});

test("switching tabs shows that pane and resets when another card opens", async () => {
  const { rerender } = renderWithBoard(<CardDialog cardId="card-3" onClose={vi.fn()} />, board);
  await userEvent.click(await screen.findByRole("tab", { name: /Spec/ }));
  expect(screen.getByRole("tab", { name: /Spec/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).not.toHaveTextContent("Description");
  rerender(<CardDialog cardId="card-2" onClose={vi.fn()} />);
  expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
});

test("opens without the zoom animation and is wider", async () => {
  renderWithBoard(<CardDialog cardId="card-2" onClose={vi.fn()} />, board);
  const dialog = await screen.findByRole("dialog");
  const content = dialog.closest("[data-slot=dialog-content]") ?? dialog;
  expect(content.className).not.toMatch(/zoom-in|animate-in/);
  expect(content.className).toMatch(/sm:max-w-3xl/);
});
