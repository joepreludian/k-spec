"use client";

import { useState } from "react";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineEdit } from "@/ui/shared/InlineEdit.jsx";
import { useBoard } from "@/ui/store/use-board.js";

export function LaneHeader({ lane, headingId, dragHandleProps }) {
  const { dispatch } = useBoard();
  const [editing, setEditing] = useState(false);
  const hasCards = lane.cards.length > 0;

  return (
    <div className="flex items-center gap-1 px-1">
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Drag lane"
          className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      )}
      <InlineEdit
        as="h2"
        id={headingId}
        value={lane.name}
        inputLabel="Lane name"
        editing={editing}
        onEditingChange={setEditing}
        onSubmit={(name) => dispatch("renameLane", { laneId: lane.id, name })}
        className="truncate text-sm font-semibold"
      />
      <Badge variant="secondary" className="tabular-nums">
        {lane.cards.length}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Lane menu">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={hasCards}
            onSelect={() => dispatch("removeLane", { laneId: lane.id })}
          >
            Remove lane
            {hasCards && <span className="ml-1 text-xs text-muted-foreground">(move cards out first)</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
