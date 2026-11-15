"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/ui/store/use-board.js";
import { CommentItem } from "./CommentItem.jsx";

const SHOW_AGENT_TOGGLE = process.env.NODE_ENV !== "production";
const DEV_AGENT = { kind: "agent", name: "claude" };

export function CommentsSection({ card }) {
  const { dispatch } = useBoard();
  const [body, setBody] = useState("");
  const [asAgent, setAsAgent] = useState(false);

  const submit = async () => {
    const clean = body.trim();
    if (!clean) return;
    const input = { cardId: card.id, body: clean };
    if (asAgent) input.author = DEV_AGENT;
    const result = await dispatch("addComment", input);
    if (result) setBody("");
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Comments</h3>
      {card.comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {card.comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          aria-label="Write a comment"
          placeholder="Write a comment… (markdown supported)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={!body.trim()}>
            Comment
          </Button>
          {SHOW_AGENT_TOGGLE && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox aria-label="Post as agent" checked={asAgent} onCheckedChange={(v) => setAsAgent(v === true)} />
              Post as agent <span className="rounded bg-muted px-1 font-mono">dev</span>
            </label>
          )}
        </div>
      </form>
    </section>
  );
}
