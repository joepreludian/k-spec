import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the app heading", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { level: 1, name: "k-spec" }),
  ).toBeInTheDocument();
});
