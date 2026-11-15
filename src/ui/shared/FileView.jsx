"use client";

import { MarkdownView } from "./MarkdownView.jsx";
import { useMarkdownFile } from "./use-markdown-file.js";

/** Loads and renders one project markdown file; links resolve relative to it. */
export function FileView({ path, className }) {
  const { status, content, error } = useMarkdownFile(path);
  if (status === "loading" || status === "idle") return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (status === "error") return <p className="text-sm text-muted-foreground">{error}</p>;
  return (
    <MarkdownView basePath={path} className={className}>
      {content}
    </MarkdownView>
  );
}
