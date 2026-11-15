"use client";

import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { checklistProgress } from "@/domain/card.js";
import { ProgressBar } from "@/ui/shared/ProgressBar.jsx";
import { useBoard } from "@/ui/store/use-board.js";
import { cn } from "@/lib/utils";

export function Checklist({ card, checklist }) {
  const { dispatch } = useBoard();
  const [text, setText] = useState("");
  const progress = checklistProgress(checklist);
  const ids = { cardId: card.id, checklistId: checklist.id };
  const titleId = `checklist-title-${checklist.id}`;

  const addItem = async () => {
    const clean = text.trim();
    if (!clean) return;
    const result = await dispatch("addChecklistItem", { ...ids, text: clean });
    if (result) setText("");
  };

  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h4 id={titleId} className="text-sm font-medium">
          {checklist.title}
        </h4>
        <span className="text-xs tabular-nums text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Checklist menu">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => dispatch("removeChecklist", ids)}>
              Delete checklist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ProgressBar done={progress.done} total={progress.total} />
      <ul className="flex flex-col">
        {checklist.items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
            <Checkbox
              id={`item-${item.id}`}
              aria-label={item.text}
              checked={item.done}
              onCheckedChange={() => dispatch("toggleChecklistItem", { ...ids, itemId: item.id })}
            />
            <label
              htmlFor={`item-${item.id}`}
              className={cn("flex-1 cursor-pointer text-sm", item.done && "text-muted-foreground line-through")}
            >
              {item.text}
            </label>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove item ${item.text}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => dispatch("removeChecklistItem", { ...ids, itemId: item.id })}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
      >
        <Input
          aria-label="Add an item"
          placeholder="Add an item"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
