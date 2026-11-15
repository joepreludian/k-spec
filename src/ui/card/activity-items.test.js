import { activityItems } from "./activity-items.js";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

test("merges comments and events by time, oldest first", () => {
  const card = findCard(seedBoard(), "card-3").card;
  const items = activityItems(card);
  expect(items.map((i) => i.at)).toEqual([...items.map((i) => i.at)].sort());
  expect(items.filter((i) => i.kind === "comment")).toHaveLength(card.comments.length);
  expect(items.filter((i) => i.kind === "event")).toHaveLength(card.events.length);
  expect(items[0]).toMatchObject({ kind: "event", event: { type: "status-changed" } });
});

test("comments come before events on equal timestamps", () => {
  const at = "2026-11-14T10:00:00.000Z";
  const card = {
    comments: [{ id: "m", createdAt: at }],
    events: [{ type: "work-ended", at }],
  };
  expect(activityItems(card).map((i) => i.kind)).toEqual(["comment", "event"]);
});
