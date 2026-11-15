import { screen } from "@testing-library/react";
import { BoardView } from "../BoardView.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";

test("drag handles use a fixed accessibility id so server and client HTML match", () => {
  // dnd-kit otherwise numbers the id with a client-only counter ("DndDescribedBy-0"),
  // which React reports as a hydration mismatch on every page load. The id is used verbatim.
  renderWithBoard(<BoardView />, seedBoard());
  const handles = [...screen.getAllByRole("button", { name: "Drag lane" }), ...screen.getAllByRole("button", { name: /^Drag card / })];
  expect(handles.length).toBeGreaterThan(0);
  for (const handle of handles) expect(handle).toHaveAttribute("aria-describedby", "board-dnd");
});
