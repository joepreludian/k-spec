"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { CardTile } from "../CardTile.jsx";
import { cardDragId } from "./BoardDnd.jsx";

export function SortableCard({ card, labels, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDragId(card.id),
  });
  return (
    <CardTile
      ref={setNodeRef}
      card={card}
      labels={labels}
      onOpen={onOpen}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    />
  );
}
