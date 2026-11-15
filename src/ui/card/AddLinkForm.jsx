"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoard } from "@/ui/store/use-board.js";

/** Path + optional title → dispatches addCardLink, then `onClose()`. Stays open on a domain error. */
export function AddLinkForm({ card, onClose }) {
  const { dispatch } = useBoard();
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");

  const submit = async () => {
    const cleanPath = path.trim();
    if (!cleanPath) return;
    const input = { cardId: card.id, path: cleanPath };
    if (title.trim()) input.title = title.trim();
    const result = await dispatch("addCardLink", input);
    if (result) onClose();
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
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
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
