"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/ui/store/use-board.js";

export function DescriptionEditor({ card }) {
  const { dispatch } = useBoard();
  const [editing, setEditing] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Description</h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <DescriptionForm
          initial={card.description}
          onCancel={() => setEditing(false)}
          onSave={async (description) => {
            await dispatch("updateCardDescription", { cardId: card.id, description });
            setEditing(false);
          }}
        />
      ) : card.description ? (
        <div className="prose prose-sm max-w-none text-sm dark:prose-invert [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_a]:underline">
          <Markdown>{card.description}</Markdown>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-dashed p-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
        >
          Add a description…
        </button>
      )}
    </section>
  );
}

function DescriptionForm({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <Textarea
        autoFocus
        aria-label="Description"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        className="font-mono text-xs"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
