"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardTile } from "../CardTile.jsx";
import { cardDragId } from "./BoardDnd.jsx";

/**
 * Sortable wrapper around a CardTile. Drag listeners live on a separate grip
 * button so the tile itself keeps native click/Enter/Space to open the card
 * (dnd-kit's keyboard sensor would otherwise preventDefault on them).
 */
export function SortableCard({ card, labels, onOpen }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDragId(card.id),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/card relative", isDragging && "opacity-40")}
    >
      <CardTile card={card} labels={labels} onOpen={onOpen} className="pr-7" />
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag card ${card.title}`}
        className="absolute top-2 right-1.5 cursor-grab rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
