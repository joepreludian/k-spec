import { cardProgress, checklistSummaries } from "@/domain/card.js";
import { ProgressBar } from "@/ui/shared/ProgressBar.jsx";
import { cn } from "@/lib/utils";

function Row({ title, done, total, strong }) {
  return (
    <>
      <span className={cn("truncate", strong && "font-semibold")}>{title}</span>
      <ProgressBar done={done} total={total} />
      <span className={cn("text-right tabular-nums text-muted-foreground", strong && "font-semibold text-foreground")}>
        {done}/{total}
      </span>
    </>
  );
}

/** One named bar per checklist and, with two or more, a master "All" row. */
export function ChecklistSummary({ card }) {
  const summaries = checklistSummaries(card);
  if (summaries.length === 0) return null;
  const total = cardProgress(card);
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
      {summaries.map((s) => (
        <Row key={s.id} title={s.title} done={s.done} total={s.total} />
      ))}
      {summaries.length >= 2 && (
        <>
          <div className="col-span-3 border-t" />
          <Row title="All" done={total.done} total={total.total} strong />
        </>
      )}
    </div>
  );
}
