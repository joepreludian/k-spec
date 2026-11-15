/**
 * Comments and events merged into one timeline, oldest first.
 * Items: `{ kind: "comment", at, comment }` | `{ kind: "event", at, event }`.
 * Stable sort; on equal timestamps comments come before events.
 */
export function activityItems(card) {
  const comments = card.comments.map((comment) => ({ kind: "comment", at: comment.createdAt, comment }));
  const events = card.events.map((event) => ({ kind: "event", at: event.at, event }));
  return [...comments, ...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
