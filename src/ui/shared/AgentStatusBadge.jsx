import { cn } from "@/lib/utils";

export const AGENT_STATUS_DOT_CLASSES = Object.freeze({
  idle: "bg-muted-foreground/40",
  working: "bg-emerald-500 animate-pulse",
  "waiting-for-input": "bg-amber-500",
  blocked: "bg-red-500",
});

const STYLES = {
  working: { text: "working", chip: "text-emerald-700 dark:text-emerald-300" },
  "waiting-for-input": { text: "waiting for input", chip: "text-amber-700 dark:text-amber-300" },
  blocked: { text: "blocked", chip: "text-red-700 dark:text-red-300" },
};

/** Renders nothing for `idle`; otherwise a colored dot plus the status text. */
export function AgentStatusBadge({ status, className }) {
  const style = STYLES[status];
  if (!style) return null;
  return (
    <span
      data-status={status}
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", style.chip, className)}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", AGENT_STATUS_DOT_CLASSES[status])} />
      {style.text}
    </span>
  );
}
