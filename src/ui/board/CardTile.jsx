"use client";

import { MessageSquare } from "lucide-react";
import { cardProgress } from "@/domain/card.js";
import { AgentStatusBadge } from "@/ui/shared/AgentStatusBadge.jsx";
import { LabelChip } from "@/ui/shared/LabelChip.jsx";
import { ProgressBar } from "@/ui/shared/ProgressBar.jsx";
import { cn } from "@/lib/utils";

export function CardTile({ card, labels, onOpen, className, ref, ...rest }) {
  const cardLabels = card.labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  const progress = cardProgress(card);
  const commentCount = card.comments.length;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(card.id)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-md border bg-card p-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...rest}
    >
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
      <span className="font-medium leading-snug">{card.title}</span>
      {(card.agentStatus !== "idle" || card.checklists.length > 0 || commentCount > 0) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <AgentStatusBadge status={card.agentStatus} />
          {card.checklists.length > 0 && (
            <span className="flex items-center gap-1.5">
              <ProgressBar done={progress.done} total={progress.total} className="w-12" />
              <span>
                {progress.done}/{progress.total}
              </span>
            </span>
          )}
          {commentCount > 0 && (
            <span
              className="ml-auto flex items-center gap-1"
              aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
            >
              <MessageSquare aria-hidden="true" className="size-3.5" />
              {commentCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
