"use client";

import { useState } from "react";
import { useBoard } from "@/ui/store/use-board.js";
import { CardDialog } from "@/ui/card/CardDialog.jsx";
import { AddLaneForm } from "./AddLaneForm.jsx";
import { BoardHeader } from "./BoardHeader.jsx";
import { LaneColumn } from "./LaneColumn.jsx";
import { BoardDnd } from "./dnd/BoardDnd.jsx";
import { SortableLane } from "./dnd/SortableLane.jsx";

export function BoardView({ notice = null }) {
  const { board, dispatch } = useBoard();
  const [selectedCardId, setSelectedCardId] = useState(null);

  return (
    <div className="flex h-dvh flex-col">
      <BoardHeader />
      {notice}
      <BoardDnd
        onCardDrop={(input) => dispatch("moveCard", input)}
        onLaneDrop={(input) => dispatch("reorderLanes", input)}
      >
        <main className="flex flex-1 items-start gap-3 overflow-x-auto p-4">
          {board.lanes.map((lane) => (
            <SortableLane key={lane.id} laneId={lane.id}>
              {({ dragHandleProps }) => (
                <LaneColumn lane={lane} onOpenCard={setSelectedCardId} dragHandleProps={dragHandleProps} />
              )}
            </SortableLane>
          ))}
          <AddLaneForm />
        </main>
      </BoardDnd>
      <CardDialog cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
    </div>
  );
}
