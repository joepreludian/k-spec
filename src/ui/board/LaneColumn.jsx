"use client";

import { useBoard } from "@/ui/store/use-board.js";
import { AddCardForm } from "./AddCardForm.jsx";
import { CardTile } from "./CardTile.jsx";
import { LaneHeader } from "./LaneHeader.jsx";

export function LaneColumn({ lane, onOpenCard }) {
  const { board } = useBoard();
  const headingId = `lane-heading-${lane.id}`;

  return (
    <section
      aria-labelledby={headingId}
      data-lane-id={lane.id}
      className="flex max-h-full w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2"
    >
      <LaneHeader lane={lane} headingId={headingId} />
      <div className="flex min-h-6 flex-1 flex-col gap-2 overflow-y-auto">
        {lane.cards.map((card) => (
          <CardTile key={card.id} card={card} labels={board.labels} onOpen={onOpenCard} />
        ))}
      </div>
      <AddCardForm laneId={lane.id} />
    </section>
  );
}
