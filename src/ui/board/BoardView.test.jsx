import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardView } from "./BoardView.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { createBoard, addLane } from "@/domain/board.js";

const lane = (name) => screen.getByRole("region", { name });

test("renders lanes in order with card counts", () => {
  renderWithBoard(<BoardView />, seedBoard());
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Backlog",
    "Todo",
    "In Progress",
    "Review",
    "Done",
  ]);
  expect(within(lane("Backlog")).getByText("2")).toBeInTheDocument();
});

test("renders the board name as h1", () => {
  renderWithBoard(<BoardView />, seedBoard());
  expect(screen.getByRole("heading", { level: 1, name: "k-spec" })).toBeInTheDocument();
});

test("add card dispatches createCard", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await userEvent.click(within(lane("Todo")).getByRole("button", { name: "+ Card" }));
  await userEvent.type(screen.getByLabelText("Card title"), "New spec{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("createCard", { laneId: "lane-todo", title: "New spec" });
});

test("add card escape cancels without dispatch", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await userEvent.click(within(lane("Todo")).getByRole("button", { name: "+ Card" }));
  await userEvent.type(screen.getByLabelText("Card title"), "abc{Escape}");
  expect(executor.execute).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
});

test("add lane dispatches createLane", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await userEvent.click(screen.getByRole("button", { name: "+ Lane" }));
  await userEvent.type(screen.getByLabelText("Lane name"), "QA{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("createLane", { name: "QA" });
});

test("rename lane inline dispatches renameLane", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await userEvent.click(within(lane("Todo")).getByRole("heading", { level: 2 }));
  const input = screen.getByLabelText("Lane name");
  await userEvent.clear(input);
  await userEvent.type(input, "Next up{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("renameLane", { laneId: "lane-todo", name: "Next up" });
});

test("remove lane is disabled when lane has cards and dispatches when empty", async () => {
  const empty = addLane(seedBoard(), { id: "lane-empty", name: "Empty" });
  const { executor } = renderWithBoard(<BoardView />, empty);

  await userEvent.click(within(lane("Todo")).getByRole("button", { name: "Lane menu" }));
  const disabled = await screen.findByRole("menuitem", { name: /Remove lane/ });
  expect(disabled).toHaveAttribute("aria-disabled", "true");
  await userEvent.keyboard("{Escape}");

  await userEvent.click(within(lane("Empty")).getByRole("button", { name: "Lane menu" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Remove lane/ }));
  expect(executor.execute).toHaveBeenCalledWith("removeLane", { laneId: "lane-empty" });
});

test("clicking a card opens the detail dialog", async () => {
  renderWithBoard(<BoardView />, seedBoard());
  await userEvent.click(screen.getByRole("button", { name: /File watcher for docs\/k-spec/ }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});

test("empty board shows only the add-lane control", () => {
  renderWithBoard(<BoardView />, createBoard({ id: "b", name: "Empty board" }));
  expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  expect(screen.getByRole("button", { name: "+ Lane" })).toBeInTheDocument();
});
