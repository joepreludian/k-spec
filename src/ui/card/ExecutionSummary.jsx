import { relativeTime } from "@/ui/shared/relative-time.js";
import { cn } from "@/lib/utils";
import { formatTokens, sessionTotalTokens, shortId } from "@/ui/shared/format.js";

/** Compact "where is this being worked" strip for the top of the Overview tab. */
export function ExecutionSummary({ card }) {
  const work = card.work;
  if (!work) return <p className="text-sm text-muted-foreground">No active work</p>;
  const session = work.session;
  const items = [
    ["Location", `${work.location.kind} · ${work.location.name}`, false],
    ["Branch", work.branch, true],
    session && ["Session", shortId(session.id), true],
    session && ["Tokens", formatTokens(sessionTotalTokens(session)), false],
    session?.lastActivityAt && ["Last activity", relativeTime(session.lastActivityAt), false],
  ].filter(Boolean);
  return (
    <dl
      data-testid="execution-summary"
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-[auto_1fr_auto_1fr]"
    >
      {items.map(([label, value, mono]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={cn("min-w-0 truncate", mono && "font-mono text-xs")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
