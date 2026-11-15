import { relativeTime } from "@/ui/shared/relative-time.js";

function describe(event) {
  switch (event.type) {
    case "status-changed":
      return (
        <>
          Status changed to <b className="font-medium text-foreground">{event.to.replace(/-/g, " ")}</b>
        </>
      );
    case "work-started":
      return (
        <>
          Work started on <b className="font-medium text-foreground">{event.location.kind}</b> /{" "}
          <code className="font-mono text-[0.9em]">{event.branch}</code>
        </>
      );
    case "work-ended":
      return "Work ended";
    default:
      return event.type;
  }
}

/** A muted one-line activity entry for a card event. */
export function EventItem({ event }) {
  return (
    <p className="px-1 text-xs text-muted-foreground">
      {describe(event)} ·{" "}
      <time dateTime={event.at}>{relativeTime(event.at)}</time>
    </p>
  );
}
