"use client";

import { useMemo } from "react";
import { createHttpCommandExecutor } from "@/infrastructure/http-command-executor.js";
import { BoardProvider } from "@/ui/store/board-provider.jsx";
import { useRemoteBoard } from "@/ui/store/use-remote-board.js";
import { BoardLoadError } from "./BoardLoadError.jsx";
import { BoardView } from "./BoardView.jsx";

/** Loads the board from the server, keeps it fresh, and sends every command to the server. */
export function BoardApp() {
  const { status, board, error, accept } = useRemoteBoard();
  // One executor for the page's life. Each answer goes through `accept`, which knows whether
  // it is newer than what is on screen, and the board it returns is what gets shown.
  const executor = useMemo(() => {
    const http = createHttpCommandExecutor();
    return {
      async execute(name, input) {
        const result = await http.execute(name, input);
        return { ...result, board: accept(result) };
      },
    };
  }, [accept]);

  if (status === "loading") {
    return <p className="p-6 text-sm text-muted-foreground">Loading board…</p>;
  }
  if (status === "error") return <BoardLoadError error={error} />;
  return (
    <BoardProvider executor={executor} initialBoard={board}>
      <BoardView />
    </BoardProvider>
  );
}
