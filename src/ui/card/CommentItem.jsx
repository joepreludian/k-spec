"use client";

import { Bot, User } from "lucide-react";
import { isRequest } from "@/domain/card.js";
import { MarkdownView } from "@/ui/shared/MarkdownView.jsx";
import { relativeTime } from "@/ui/shared/relative-time.js";
import { cn } from "@/lib/utils";

/** The "to agent" tag of a request and, in words, whether an agent has answered it yet. */
function RequestState({ open }) {
  return (
    <>
      <span className="inline-flex items-center gap-1 rounded border border-current/30 px-1 text-[11px] font-medium">
        <Bot aria-hidden="true" className="size-3" />
        to agent
      </span>
      <span
        className={cn(
          "text-[11px] font-medium",
          open ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
        )}
      >
        {open ? "waiting for agent" : "answered"}
      </span>
    </>
  );
}

/** One comment. A request (see `isRequest`) also says who it is for; `open` tells if it still waits. */
export function CommentItem({ comment, open = false }) {
  const isAgent = comment.author.kind === "agent";
  const request = isRequest(comment);
  const Icon = isAgent ? Bot : User;
  return (
    <article
      data-author-kind={comment.author.kind}
      data-request={request ? (open ? "open" : "answered") : undefined}
      className={cn(
        "flex gap-3 rounded-md border p-3 text-sm",
        isAgent ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted",
        request && open && "border-amber-500/50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          isAgent ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{comment.author.name}</span>
          {request && <RequestState open={open} />}
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </time>
        </div>
        <MarkdownView className="mt-1 [&_code]:bg-background/60">{comment.body}</MarkdownView>
      </div>
    </article>
  );
}
