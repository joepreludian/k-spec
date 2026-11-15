import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardHeader } from "./BoardHeader.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { createBoard } from "@/domain/board.js";

afterEach(() => {
  delete global.fetch;
});

test("shows board and project name", () => {
  renderWithBoard(<BoardHeader />, seedBoard());
  expect(screen.getByRole("heading", { level: 1, name: "k-spec" })).toBeInTheDocument();
  expect(screen.getByText("opensource/k-spec")).toBeInTheDocument();
});

test("project links open in a new tab", () => {
  renderWithBoard(<BoardHeader />, seedBoard());
  const repo = screen.getByRole("link", { name: /Repo/ });
  expect(repo).toHaveAttribute("href", "https://github.com/opensource/k-spec");
  expect(repo).toHaveAttribute("target", "_blank");
  expect(repo).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
});

test("README opens a sheet with the rendered file and an open-in-new-tab link", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: "# k-spec readme" }) });
  renderWithBoard(<BoardHeader />, seedBoard());
  await userEvent.click(screen.getByRole("button", { name: "README" }));
  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).getByRole("heading", { name: "README.md" })).toBeInTheDocument();
  const newTab = within(sheet).getByRole("link", { name: /Open in new tab/ });
  expect(newTab).toHaveAttribute("href", "/files/README.md");
  expect(newTab).toHaveAttribute("target", "_blank");
  expect(await within(sheet).findByRole("heading", { name: "k-spec readme" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("/api/files/README.md", expect.anything());
});

test("hides project name and README when the project block is empty", () => {
  renderWithBoard(<BoardHeader />, createBoard({ id: "b", name: "Bare" }));
  expect(screen.queryByText("/")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "README" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
