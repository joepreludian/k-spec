"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { laneDragId } from "./BoardDnd.jsx";

/** Wraps a lane so it sorts horizontally; the lane header is the drag handle. */
export function SortableLane({ laneId, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: laneDragId(laneId),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("shrink-0", isDragging && "opacity-50")}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}
