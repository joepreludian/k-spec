"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoard } from "@/ui/store/use-board.js";

/** "Add link" toggle → path + optional title → dispatches addCardLink. Stays open on a domain error. */
export function AddLinkForm({ card }) {
  const { dispatch } = useBoard();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");

  const close = () => {
    setOpen(false);
    setPath("");
    setTitle("");
  };
  const submit = async () => {
    const cleanPath = path.trim();
    if (!cleanPath) return;
    const input = { cardId: card.id, path: cleanPath };
    if (title.trim()) input.title = title.trim();
    const result = await dispatch("addCardLink", input);
    if (result) close();
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add link
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <Input
        autoFocus
        aria-label="File path"
        placeholder="docs/specs/feature.md"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        className="h-8 font-mono text-xs"
      />
      <Input
        aria-label="Title (optional)"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!path.trim()}>
          Link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
