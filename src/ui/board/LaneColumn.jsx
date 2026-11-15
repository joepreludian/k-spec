"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useBoard } from "@/ui/store/use-board.js";
import { AddCardForm } from "./AddCardForm.jsx";
import { LaneHeader } from "./LaneHeader.jsx";
import { cardDragId } from "./dnd/BoardDnd.jsx";
import { SortableCard } from "./dnd/SortableCard.jsx";

export function LaneColumn({ lane, onOpenCard, dragHandleProps }) {
  const { board } = useBoard();
  const headingId = `lane-heading-${lane.id}`;

  return (
    <section
      aria-labelledby={headingId}
      data-lane-id={lane.id}
      className="flex max-h-full w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2"
    >
      <LaneHeader lane={lane} headingId={headingId} dragHandleProps={dragHandleProps} />
      <SortableContext items={lane.cards.map((c) => cardDragId(c.id))} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-6 flex-1 flex-col gap-2 overflow-y-auto">
          {lane.cards.map((card) => (
            <SortableCard key={card.id} card={card} labels={board.labels} onOpen={onOpenCard} />
          ))}
        </div>
      </SortableContext>
      <AddCardForm laneId={lane.id} />
    </section>
  );
}
