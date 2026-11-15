import { screen } from "@testing-library/react";
import { BoardView } from "./BoardView.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";

const captured = {};

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: (props) => {
      captured.onDragEnd = props.onDragEnd;
      captured.onDragStart = props.onDragStart;
      return <div data-testid="dnd">{props.children}</div>;
    },
    DragOverlay: ({ children }) => <div data-testid="overlay">{children}</div>,
  };
});

test("dropping a card on a lane dispatches moveCard with the computed position", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  expect(typeof captured.onDragEnd).toBe("function");
  await captured.onDragEnd({ active: { id: "card:card-7" }, over: { id: "lane:lane-todo" } });
  expect(executor.execute).toHaveBeenCalledWith("moveCard", { cardId: "card-7", toLaneId: "lane-todo", position: 2 });
});

test("dropping a card on another card dispatches moveCard before it", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await captured.onDragEnd({ active: { id: "card:card-7" }, over: { id: "card:card-5" } });
  expect(executor.execute).toHaveBeenCalledWith("moveCard", { cardId: "card-7", toLaneId: "lane-todo", position: 0 });
});

test("dropping a lane on another lane dispatches reorderLanes", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await captured.onDragEnd({ active: { id: "lane:lane-backlog" }, over: { id: "lane:lane-todo" } });
  expect(executor.execute).toHaveBeenCalledWith("reorderLanes", {
    laneIds: ["lane-todo", "lane-backlog", "lane-in-progress", "lane-review", "lane-done"],
  });
});

test("a no-op drop dispatches nothing", async () => {
  const { executor } = renderWithBoard(<BoardView />, seedBoard());
  await captured.onDragEnd({ active: { id: "card:card-7" }, over: { id: "card:card-7" } });
  await captured.onDragEnd({ active: { id: "card:card-7" }, over: null });
  expect(executor.execute).not.toHaveBeenCalled();
  expect(screen.getByTestId("dnd")).toBeInTheDocument();
});
