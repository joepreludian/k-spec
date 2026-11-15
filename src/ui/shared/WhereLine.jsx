import { cn } from "@/lib/utils";

/** "[lima] feat/watcher": where a card is being worked. Renders nothing without work. */
export function WhereLine({ work, className }) {
  if (!work) return null;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span
        title={work.location.name}
        className="shrink-0 rounded border bg-muted/40 px-1.5 font-semibold leading-4 text-foreground/80"
      >
        {work.location.kind}
      </span>
      <span className="truncate font-mono">{work.branch}</span>
    </span>
  );
}
