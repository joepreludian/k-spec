"use client";

import { useState } from "react";
import { useBoard } from "@/ui/store/use-board.js";
import { CardDialog } from "@/ui/card/CardDialog.jsx";
import { AddLaneForm } from "./AddLaneForm.jsx";
import { BoardHeader } from "./BoardHeader.jsx";
import { LaneColumn } from "./LaneColumn.jsx";

export function BoardView() {
  const { board } = useBoard();
  const [selectedCardId, setSelectedCardId] = useState(null);

  return (
    <div className="flex h-dvh flex-col">
      <BoardHeader />
      <main className="flex flex-1 items-start gap-3 overflow-x-auto p-4">
        {board.lanes.map((lane) => (
          <LaneColumn key={lane.id} lane={lane} onOpenCard={setSelectedCardId} />
        ))}
        <AddLaneForm />
      </main>
      <CardDialog cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
    </div>
  );
}
