"use client";

import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileView } from "@/ui/shared/FileView.jsx";
import { filePageUrl } from "@/ui/shared/file-urls.js";
import { useBoard } from "@/ui/store/use-board.js";
import { cn } from "@/lib/utils";
import { AddLinkForm } from "./AddLinkForm.jsx";

/** Linked markdown files on the left, the selected one rendered on the right. */
export function SpecTab({ card }) {
  const { dispatch } = useBoard();
  const [selectedId, setSelectedId] = useState(null);
  const selected = card.links.find((l) => l.id === selectedId) ?? card.links[0] ?? null;

  return (
    <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 sm:border-r sm:pr-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked files</h3>
        {card.links.length === 0 && <p className="text-sm text-muted-foreground">No linked files yet</p>}
        {card.links.map((link) => {
          const active = selected?.id === link.id;
          return (
            <div key={link.id} className="group flex items-start gap-1">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(link.id)}
                className={cn(
                  "min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                  active && "bg-muted font-medium",
                )}
              >
                <span className="block truncate">{link.title}</span>
                <small className="block truncate font-mono text-[10px] font-normal text-muted-foreground">{link.path}</small>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove link ${link.title}`}
                className="mt-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => dispatch("removeCardLink", { cardId: card.id, linkId: link.id })}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        <AddLinkForm card={card} />
      </div>
      <div className="min-w-0">
        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-muted-foreground">{selected.path}</span>
              <Button asChild variant="ghost" size="sm">
                <a href={filePageUrl(selected.path)} target="_blank" rel="noreferrer noopener">
                  Open in new tab
                  <ExternalLink aria-hidden="true" data-icon="inline-end" />
                </a>
              </Button>
            </div>
            <div className="rounded-md border p-3">
              <FileView path={selected.path} newTab />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Link a markdown file to read it here.</p>
        )}
      </div>
    </div>
  );
}
