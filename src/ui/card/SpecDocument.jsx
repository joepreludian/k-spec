"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileView } from "@/ui/shared/FileView.jsx";
import { filePageUrl } from "@/ui/shared/file-urls.js";

/** One linked file across the whole Spec tab, under a header that stays put while it scrolls. */
export function SpecDocument({ link, onBack }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background pb-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Files
        </Button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{link.path}</span>
        <Button asChild variant="ghost" size="sm">
          <a href={filePageUrl(link.path)} target="_blank" rel="noreferrer noopener">
            Open in new tab
            <ExternalLink aria-hidden="true" data-icon="inline-end" />
          </a>
        </Button>
      </div>
      <div className="pt-3">
        <FileView path={link.path} newTab />
      </div>
    </div>
  );
}
