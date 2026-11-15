import { render } from "@testing-library/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardProvider } from "@/ui/store/board-provider.jsx";

/**
 * Render `ui` inside a BoardProvider with a mocked executor (plus Tooltip and Toaster so
 * domain-error toasts can be asserted). Returns { executor, rerender, ...renderResult };
 * `rerender(ui)` keeps the same providers.
 */
export function renderWithBoard(ui, board, { executor } = {}) {
  const ex = executor ?? { execute: vi.fn().mockResolvedValue({ board }) };
  const wrap = (node) => (
    <TooltipProvider>
      <BoardProvider executor={ex} initialBoard={board}>
        {node}
      </BoardProvider>
      <Toaster />
    </TooltipProvider>
  );
  const result = render(wrap(ui));
  return { executor: ex, ...result, rerender: (node) => result.rerender(wrap(node)) };
}
