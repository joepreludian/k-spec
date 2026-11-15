import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the seeded board name as the heading", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1, name: "k-spec" })).toBeInTheDocument();
});

test("renders the default lanes", () => {
  render(<Page />);
  expect(screen.getByText("Backlog")).toBeInTheDocument();
  expect(screen.getByText("Done")).toBeInTheDocument();
});
