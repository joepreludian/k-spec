"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileView } from "@/ui/shared/FileView.jsx";
import { filePageUrl } from "@/ui/shared/file-urls.js";

/** "README" button that opens the project's README in a right-hand sheet over the board. */
export function ReadmeSheet({ path }) {
  if (!path) return null;
  const name = path.split("/").pop();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">README</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b pr-10">
          <div className="min-w-0">
            <SheetTitle className="truncate font-mono text-sm">{name}</SheetTitle>
            <SheetDescription className="sr-only">Project README</SheetDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href={filePageUrl(path)} target="_blank" rel="noreferrer noopener">
              Open in new tab
              <ExternalLink aria-hidden="true" data-icon="inline-end" />
            </a>
          </Button>
        </SheetHeader>
        <div className="p-4">
          <FileView path={path} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
