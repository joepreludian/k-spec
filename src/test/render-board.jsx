import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardProvider } from "@/ui/store/board-provider.jsx";

/** Render `ui` inside a BoardProvider with a mocked executor. Returns { executor, ...renderResult }. */
export function renderWithBoard(ui, board, { executor } = {}) {
  const ex = executor ?? { execute: vi.fn().mockResolvedValue({ board }) };
  const result = render(
    <TooltipProvider>
      <BoardProvider executor={ex} initialBoard={board}>
        {ui}
      </BoardProvider>
    </TooltipProvider>,
  );
  return { executor: ex, ...result };
}
