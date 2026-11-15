import { render, screen } from "@testing-library/react";
import { ExecutionTab } from "./ExecutionTab.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const card = (id) => findCard(seedBoard(), id).card;

test("shows where, session and history for card-3", () => {
  render(<ExecutionTab card={card("card-3")} />);
  expect(screen.getByText("lima · lima-dev-k-spec-watcher")).toBeInTheDocument();
  expect(screen.getByText("feat/watcher")).toBeInTheDocument();
  expect(screen.getByText("~/work/k-spec")).toBeInTheDocument();
  expect(screen.getByText(/· running$/)).toBeInTheDocument();
  expect(screen.getByText("8c4acf00-42c1-4317-b31b-d24e744d30d3")).toBeInTheDocument();
  expect(screen.getByText("claude-fable-5-1")).toBeInTheDocument();
  expect(screen.getByText("184k in · 22k out · 61k cached")).toBeInTheDocument();
  expect(screen.getByText("37")).toBeInTheDocument();
  expect(screen.getByText(/^Bash · /)).toBeInTheDocument();
  expect(screen.getByText(/^host \/ main · 2026-11-14 · session a9cb8a9d… · 41k tokens$/)).toBeInTheDocument();
});

test("shows dashes when there is work but no session", () => {
  render(<ExecutionTab card={card("card-4")} />);
  expect(screen.getByText("feat/cli")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  expect(screen.getByText("No previous work on this card.")).toBeInTheDocument();
  expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
});

test("empty state without work or history", () => {
  render(<ExecutionTab card={card("card-1")} />);
  expect(screen.getByText("This card has not been worked on yet.")).toBeInTheDocument();
  expect(screen.queryByText("Where")).not.toBeInTheDocument();
});
