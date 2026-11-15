"use client";

import { Bot, User } from "lucide-react";
import Markdown from "react-markdown";
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
        <div className="mt-1 [&_p]:my-1 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
          <Markdown>{comment.body}</Markdown>
        </div>
      </div>
    </article>
  );
}
