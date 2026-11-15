import { checklistSummaries } from "@/domain/card.js";
import { ProgressBar } from "@/ui/shared/ProgressBar.jsx";

/** One progress segment per checklist in a single row; names on hover. */
export function ChecklistSegments({ card }) {
  const summaries = checklistSummaries(card);
  if (summaries.length === 0) return null;
  const label = summaries.map((s) => `${s.title} ${s.done}/${s.total}`).join(" · ");
  return (
    <div className="flex w-full gap-[3px]" title={label} aria-label={label}>
      {summaries.map((s) => (
        <ProgressBar key={s.id} done={s.done} total={s.total} className="h-1 flex-1" />
      ))}
    </div>
  );
}
