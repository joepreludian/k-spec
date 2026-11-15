import { cn } from "@/lib/utils";

/** Dot colour + motion per status. Waiting and blocked animate so they catch the eye. */
export const AGENT_STATUS_DOT_CLASSES = Object.freeze({
  idle: "bg-muted-foreground/40",
  working: "bg-emerald-500 animate-pulse motion-reduce:animate-none",
  "waiting-for-input": "bg-amber-500 animate-blink motion-reduce:animate-none",
  blocked: "bg-red-500 animate-ring motion-reduce:animate-none",
});

const STYLES = {
  working: { text: "working", chip: "text-emerald-700 dark:text-emerald-300" },
  "waiting-for-input": { text: "waiting for input", chip: "text-amber-700 dark:text-amber-300" },
  blocked: { text: "blocked", chip: "text-red-700 dark:text-red-300" },
};

/** The coloured (and for waiting/blocked, animated) dot alone. Decorative. */
export function StatusDot({ status, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", AGENT_STATUS_DOT_CLASSES[status], className)}
    />
  );
}

/** Renders nothing for `idle`; otherwise a colored dot plus the status text. */
export function AgentStatusBadge({ status, className }) {
  const style = STYLES[status];
  if (!style) return null;
  return (
    <span
      data-status={status}
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", style.chip, className)}
    >
      <StatusDot status={status} />
      {style.text}
    </span>
  );
}
