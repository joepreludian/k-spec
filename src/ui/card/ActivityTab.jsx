"use client";

import { activityItems } from "./activity-items.js";
import { CommentForm } from "./CommentForm.jsx";
import { CommentItem } from "./CommentItem.jsx";
import { EventItem } from "./EventItem.jsx";

/** Comments and status/work events in one timeline, with the composer at the bottom. */
export function ActivityTab({ card }) {
  const items = activityItems(card);
  return (
    <section className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul aria-label="Activity" className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item.kind === "comment" ? item.comment.id : `event-${index}`}>
              {item.kind === "comment" ? <CommentItem comment={item.comment} /> : <EventItem event={item.event} />}
            </li>
          ))}
        </ul>
      )}
      <CommentForm card={card} />
    </section>
  );
}
