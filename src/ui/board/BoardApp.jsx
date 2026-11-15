"use client";

import { createBrowserExecutor, initialBoard } from "@/infrastructure/browser-executor.js";
import { BoardProvider } from "@/ui/store/board-provider.jsx";
import { useBoard } from "@/ui/store/use-board.js";

function BoardPlaceholder() {
  const { board } = useBoard();
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">{board.name}</h1>
      <ul className="mt-4 flex gap-4 text-sm text-muted-foreground">
        {board.lanes.map((lane) => (
          <li key={lane.id}>{lane.name}</li>
        ))}
      </ul>
    </main>
  );
}

export function BoardApp() {
  return (
    <BoardProvider executor={createBrowserExecutor()} initialBoard={initialBoard}>
      <BoardPlaceholder />
    </BoardProvider>
  );
}
