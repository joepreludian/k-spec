"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { findCard } from "@/domain/board.js";
import { useBoard } from "@/ui/store/use-board.js";
import { CardTile } from "../CardTile.jsx";
import { computeCardDrop, computeLaneDrop, parseDragId } from "./compute-drop.js";

export const laneDragId = (laneId) => `lane:${laneId}`;
export const cardDragId = (cardId) => `card:${cardId}`;

/**
 * DndContext for the board: lanes sort horizontally, cards sort within and
 * across lanes. On drop, translates the gesture into a command input and calls
 * `onCardDrop(moveCardInput)` or `onLaneDrop(reorderLanesInput)`.
 */
export function BoardDnd({ onCardDrop, onLaneDrop, children }) {
  const { board } = useBoard();
  const [active, setActive] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = ({ active: a }) => setActive(parseDragId(a.id));

  const handleDragEnd = async ({ active: a, over }) => {
    setActive(null);
    const kind = parseDragId(a?.id)?.kind;
    const ids = { activeId: a?.id, overId: over?.id ?? null };
    if (kind === "card") {
      const drop = computeCardDrop(board, ids);
      if (drop) await onCardDrop(drop);
    } else if (kind === "lane") {
      const drop = computeLaneDrop(board, ids);
      if (drop) await onLaneDrop(drop);
    }
  };

  const activeCard = active?.kind === "card" ? findCard(board, active.id)?.card : null;
  const activeLane = active?.kind === "lane" ? board.lanes.find((l) => l.id === active.id) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <SortableContext items={board.lanes.map((l) => laneDragId(l.id))} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <CardTile card={activeCard} labels={board.labels} onOpen={() => {}} className="rotate-2 shadow-lg" />
        )}
        {activeLane && (
          <div className="w-72 rounded-lg border bg-muted/80 p-3 text-sm font-semibold shadow-lg">{activeLane.name}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
