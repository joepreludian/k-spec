"use client";

import { Loader2 } from "lucide-react";
import { useBoard } from "@/ui/store/use-board.js";
import { ProjectLinks } from "./ProjectLinks.jsx";
import { ReadmeSheet } from "./ReadmeSheet.jsx";

export function BoardHeader() {
  const { board, pending } = useBoard();
  const project = board.project ?? { name: "", links: [], readmePath: null };
  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <h1 className="text-base font-semibold tracking-tight">{board.name}</h1>
      {project.name && (
        <>
          <span aria-hidden="true" className="text-muted-foreground/50">
            /
          </span>
          <span className="text-sm text-muted-foreground">{project.name}</span>
        </>
      )}
      {pending && <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted-foreground" />}
      <div className="ml-auto flex items-center gap-2">
        <ProjectLinks links={project.links} />
        <ReadmeSheet path={project.readmePath} />
      </div>
    </header>
  );
}
