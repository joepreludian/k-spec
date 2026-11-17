"use client";

import { useMemo } from "react";
import { createBrowserExecutor } from "@/infrastructure/browser-executor.js";
import { BoardProvider } from "@/ui/store/board-provider.jsx";
import { useRemoteBoard } from "@/ui/store/use-remote-board.js";
import { BoardLoadError, BoardStaleNotice } from "./BoardLoadError.jsx";
import { BoardView } from "./BoardView.jsx";

/** Loads the board the server reads from the kspec root and keeps it fresh. */
export function BoardApp() {
  const { status, board, error } = useRemoteBoard();
  // A reloaded board gets a fresh in-memory repository, so later commands build on it.
  const executor = useMemo(() => (board ? createBrowserExecutor(board) : null), [board]);

  if (status === "loading") {
    return <p className="p-6 text-sm text-muted-foreground">Loading board…</p>;
  }
  if (status === "error") return <BoardLoadError error={error} />;
  return (
    <BoardProvider executor={executor} initialBoard={board}>
      <BoardView notice={error ? <BoardStaleNotice error={error} /> : null} />
    </BoardProvider>
  );
}
