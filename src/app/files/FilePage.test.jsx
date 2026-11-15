import { render, screen } from "@testing-library/react";
import { FilePage } from "./FilePage.jsx";

afterEach(() => {
  delete global.fetch;
});

test("renders the path as heading, a back link and the file", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: "body text" }) });
  render(<FilePage path="docs/a.md" />);
  expect(screen.getByRole("heading", { level: 1, name: "docs/a.md" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to board" })).toHaveAttribute("href", "/");
  expect(await screen.findByText("body text")).toBeInTheDocument();
});
