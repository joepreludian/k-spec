"use client";

import { Bot, User } from "lucide-react";
import { MarkdownView } from "@/ui/shared/MarkdownView.jsx";
import { relativeTime } from "@/ui/shared/relative-time.js";
import { cn } from "@/lib/utils";

export function CommentItem({ comment }) {
  const isAgent = comment.author.kind === "agent";
  const Icon = isAgent ? Bot : User;
  return (
    <article
      data-author-kind={comment.author.kind}
      className={cn(
        "flex gap-3 rounded-md border p-3 text-sm",
        isAgent ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted",
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
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{comment.author.name}</span>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </time>
        </div>
        <MarkdownView className="mt-1 [&_code]:bg-background/60">{comment.body}</MarkdownView>
      </div>
    </article>
  );
}
