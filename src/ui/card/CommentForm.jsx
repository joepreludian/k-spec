"use client";

import { Bot } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/ui/store/use-board.js";

const SHOW_AGENT_TOGGLE = process.env.NODE_ENV !== "production";
const DEV_AGENT = { kind: "agent", name: "claude" };

/**
 * Comment composer. "Comment" leaves a note for people; "Send to agent" posts the same text as a
 * request, which a watching agent is told about and which stays open until an agent answers.
 * Dev builds can post as the agent to exercise the agent styling (an agent cannot send a request).
 */
export function CommentForm({ card }) {
  const { dispatch } = useBoard();
  const [body, setBody] = useState("");
  const [asAgent, setAsAgent] = useState(false);

  const submit = async ({ request = false } = {}) => {
    const clean = body.trim();
    if (!clean) return;
    const input = { cardId: card.id, body: clean };
    if (asAgent) input.author = DEV_AGENT;
    else if (request) input.request = true;
    const result = await dispatch("addComment", input);
    if (result) setBody("");
  };

  return (
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!body.trim() || asAgent}
          onClick={() => submit({ request: true })}
        >
          <Bot aria-hidden="true" />
          Send to agent
        </Button>
        {SHOW_AGENT_TOGGLE && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox aria-label="Post as agent" checked={asAgent} onCheckedChange={(v) => setAsAgent(v === true)} />
            Post as agent <span className="rounded bg-muted px-1 font-mono">dev</span>
          </label>
        )}
      </div>
    </form>
  );
}
