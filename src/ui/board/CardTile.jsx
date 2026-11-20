"use client";

import { Bot, ListChecks, MessageSquare } from "lucide-react";
import { cardProgress, openRequests } from "@/domain/card.js";
import { AgentStatusBadge } from "@/ui/shared/AgentStatusBadge.jsx";
import { LabelChip } from "@/ui/shared/LabelChip.jsx";
import { ServiceIndicator } from "@/ui/shared/ServiceIndicator.jsx";
import { WhereLine } from "@/ui/shared/WhereLine.jsx";
import { cn } from "@/lib/utils";
import { ChecklistSegments } from "./ChecklistSegments.jsx";

export function CardTile({ card, labels, onOpen, className, ref, ...rest }) {
  const cardLabels = card.labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  const progress = cardProgress(card);
  const commentCount = card.comments.length;
  const hasChecklists = card.checklists.length > 0;
  const services = card.work?.services ?? [];
  const waiting = openRequests(card).length; // requests no agent has answered yet
  const showMeta = card.agentStatus !== "idle" || hasChecklists || commentCount > 0 || services.length > 0;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(card.id)}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-md border bg-card p-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...rest}
    >
      <span className="leading-snug">
        <span className="text-muted-foreground">#{card.number}</span>{" "}
        <span className="font-medium">{card.title}</span>
      </span>
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
      <WhereLine work={card.work} />
      {showMeta && (
        <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
          <AgentStatusBadge status={card.agentStatus} />
          <span className="ml-auto flex items-center gap-3">
            <ServiceIndicator services={services} />
            {waiting > 0 && (
              <span
                className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300"
                aria-label={`${waiting} ${waiting === 1 ? "request" : "requests"} waiting for agent`}
              >
                <Bot aria-hidden="true" className="size-3.5" />
                {waiting}
              </span>
            )}
            {hasChecklists && (
              <span
                className="flex items-center gap-1 tabular-nums"
                aria-label={`${progress.done} of ${progress.total} checklist items done`}
              >
                <ListChecks aria-hidden="true" className="size-3.5" />
                {progress.done}/{progress.total}
              </span>
            )}
            {commentCount > 0 && (
              <span
                className="flex items-center gap-1"
                aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
              >
                <MessageSquare aria-hidden="true" className="size-3.5" />
                {commentCount}
              </span>
            )}
          </span>
        </div>
      )}
      <ChecklistSegments card={card} />
    </button>
  );
}
