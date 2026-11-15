import { formatTokens, sessionTotalTokens, shortId } from "@/ui/shared/format.js";
import { relativeTime } from "@/ui/shared/relative-time.js";
import { cn } from "@/lib/utils";

const DASH = "—";

function Grid({ title, rows }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("min-w-0 break-all", mono && value !== DASH && "font-mono text-xs")}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const tokensLine = (t) => `${formatTokens(t.input)} in · ${formatTokens(t.output)} out · ${formatTokens(t.cached)} cached`;

function historyLine(entry) {
  const parts = [
    `${entry.location.kind} / ${entry.branch}`,
    entry.startedAt.slice(0, 10),
    entry.session && `session ${shortId(entry.session.id)}`,
    entry.session && `${formatTokens(sessionTotalTokens(entry.session))} tokens`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Where the card is being worked, the Claude session behind it, and previous work blocks. */
export function ExecutionTab({ card }) {
  const { work, workHistory } = card;
  if (!work && workHistory.length === 0) {
    return <p className="text-sm text-muted-foreground">This card has not been worked on yet.</p>;
  }
  const session = work?.session ?? null;
  return (
    <div className="flex flex-col gap-5">
      {work && (
        <Grid
          title="Where"
          rows={[
            ["Location", `${work.location.kind} · ${work.location.name}`],
            ["Branch", work.branch, true],
            ["Worktree", work.worktreePath ?? DASH, true],
            ["Started", `${relativeTime(work.startedAt)} · running`],
          ]}
        />
      )}
      {work && (
        <Grid
          title="Claude session"
          rows={[
            ["Session", session?.id ?? DASH, true],
            ["Model", session?.model ?? DASH],
            ["Tokens", session ? tokensLine(session.tokens) : DASH],
            ["Turns", session ? String(session.turns) : DASH],
            ["Last tool", session?.lastTool ? `${session.lastTool.name} · ${relativeTime(session.lastTool.at)}` : DASH],
          ]}
        />
      )}
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h4>
        {workHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous work on this card.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...workHistory].reverse().map((entry) => (
              <li key={`${entry.startedAt}-${entry.branch}`} className="text-muted-foreground">
                {historyLine(entry)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
