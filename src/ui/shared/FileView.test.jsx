import { render, screen } from "@testing-library/react";
import { FileView } from "./FileView.jsx";

afterEach(() => {
  delete global.fetch;
});

test("shows Loading… then the rendered markdown with links relative to the file", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: "# Title\n[plan](plan.md)" }) });
  render(<FileView path="docs/README.md" />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Title" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "plan" })).toHaveAttribute("href", "/files/docs/plan.md");
});

test("shows the error text", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  render(<FileView path="nope.md" />);
  expect(await screen.findByText("Not found")).toBeInTheDocument();
});

test("newTab is passed through so board-side viewers never navigate the board away", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: "[plan](plan.md)" }) });
  render(<FileView path="docs/README.md" newTab />);
  expect(await screen.findByRole("link", { name: "plan" })).toHaveAttribute("target", "_blank");
});
