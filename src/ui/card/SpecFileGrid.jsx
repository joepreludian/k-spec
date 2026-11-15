"use client";

import { useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/ui/store/use-board.js";
import { AddLinkForm } from "./AddLinkForm.jsx";

const TILE =
  "flex w-full flex-col items-center gap-1.5 rounded-md px-1 py-2 text-center text-xs hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The card's linked files as a flat icon grid, ending with an "Add link" tile. */
export function SpecFileGrid({ card, onOpen }) {
  const { dispatch } = useBoard();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] items-start gap-2">
        {card.links.map((link) => (
          <div key={link.id} className="group relative">
            <button type="button" title={link.path} onClick={() => onOpen(link.id)} className={TILE}>
              <FileText aria-hidden="true" strokeWidth={1.25} className="size-10 text-muted-foreground" />
              <span className="line-clamp-2 w-full break-words">{link.title}</span>
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove link ${link.title}`}
              className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => dispatch("removeCardLink", { cardId: card.id, linkId: link.id })}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
        <button type="button" onClick={() => setAdding(true)} className={`${TILE} text-muted-foreground`}>
          <span className="flex size-10 items-center justify-center rounded-md border border-dashed">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <span>Add link</span>
        </button>
      </div>
      {card.links.length === 0 && <p className="text-sm text-muted-foreground">No linked files yet</p>}
      {adding && (
        <div className="max-w-sm">
          <AddLinkForm card={card} onClose={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}
