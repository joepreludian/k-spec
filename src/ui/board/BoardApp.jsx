"use client";

import { createBrowserExecutor, initialBoard } from "@/infrastructure/browser-executor.js";
import { BoardProvider } from "@/ui/store/board-provider.jsx";
import { BoardView } from "./BoardView.jsx";

export function BoardApp() {
  return (
    <BoardProvider executor={createBrowserExecutor()} initialBoard={initialBoard}>
      <BoardView />
    </BoardProvider>
  );
}
