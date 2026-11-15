"use client";

import { Loader2 } from "lucide-react";
import { useBoard } from "@/ui/store/use-board.js";

export function BoardHeader() {
  const { board, pending } = useBoard();
  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <h1 className="text-base font-semibold tracking-tight">{board.name}</h1>
      {pending && <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted-foreground" />}
    </header>
  );
}
