import { render, screen } from "@testing-library/react";
import { ExecutionSummary } from "./ExecutionSummary.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const card = (id) => findCard(seedBoard(), id).card;

test("summarises active work", () => {
  render(<ExecutionSummary card={card("card-3")} />);
  expect(screen.getByText("lima · lima-dev-k-spec-watcher")).toBeInTheDocument();
  expect(screen.getByText("feat/watcher")).toBeInTheDocument();
  expect(screen.getByText("8c4acf00…")).toBeInTheDocument();
  expect(screen.getByText("206k")).toBeInTheDocument();
  expect(screen.getByText("Last activity")).toBeInTheDocument();
});

test("omits session items when there is no session", () => {
  render(<ExecutionSummary card={card("card-4")} />);
  expect(screen.getByText("feat/cli")).toBeInTheDocument();
  expect(screen.queryByText("Session")).not.toBeInTheDocument();
  expect(screen.queryByText("Tokens")).not.toBeInTheDocument();
  expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
});

test("says so when there is no work", () => {
  render(<ExecutionSummary card={card("card-1")} />);
  expect(screen.getByText("No active work")).toBeInTheDocument();
});
