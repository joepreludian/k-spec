import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpecTab } from "./SpecTab.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";
import { InvalidLinkPath } from "@/domain/errors.js";

const board = seedBoard();
const card3 = findCard(board, "card-3").card;
const okFetch = (content) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content }) });

afterEach(() => {
  delete global.fetch;
});

test("lists links, selects the first, fetches and renders it with an open-in-new-tab link", async () => {
  global.fetch = okFetch("# Design doc");
  renderWithBoard(<SpecTab card={card3} />, board);
  expect(screen.getByRole("button", { name: /^Board UI design/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /^Board UI plan/ })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("docs/specs/2026-11-14-k-spec-board-ui-plan.md")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Design doc" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open in new tab/ })).toHaveAttribute(
    "href",
    "/files/docs/specs/2026-11-14-k-spec-board-ui-design.md",
  );
  expect(global.fetch).toHaveBeenCalledWith("/api/files/docs/specs/2026-11-14-k-spec-board-ui-design.md", expect.anything());
});

test("clicking another link fetches it", async () => {
  global.fetch = okFetch("x");
  renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: /^Board UI plan/ }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenLastCalledWith("/api/files/docs/specs/2026-11-14-k-spec-board-ui-plan.md", expect.anything()),
  );
  expect(screen.getByRole("button", { name: /^Board UI plan/ })).toHaveAttribute("aria-pressed", "true");
});

test("adding a link dispatches addCardLink and closes the form", async () => {
  global.fetch = okFetch("x");
  const { executor } = renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Add link" }));
  await userEvent.type(screen.getByLabelText("File path"), "docs/notes.md");
  await userEvent.type(screen.getByLabelText("Title (optional)"), "Notes");
  await userEvent.click(screen.getByRole("button", { name: "Link" }));
  expect(executor.execute).toHaveBeenCalledWith("addCardLink", { cardId: "card-3", path: "docs/notes.md", title: "Notes" });
  await waitFor(() => expect(screen.queryByLabelText("File path")).not.toBeInTheDocument());
});

test("a blank title is omitted from the dispatch", async () => {
  global.fetch = okFetch("x");
  const { executor } = renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Add link" }));
  await userEvent.type(screen.getByLabelText("File path"), "docs/notes.md{Enter}");
  expect(executor.execute).toHaveBeenCalledWith("addCardLink", { cardId: "card-3", path: "docs/notes.md" });
});

test("a rejected path keeps the form open and shows a toast", async () => {
  global.fetch = okFetch("x");
  const executor = { execute: vi.fn().mockRejectedValue(new InvalidLinkPath("notes.txt")) };
  renderWithBoard(<SpecTab card={card3} />, board, { executor });
  await userEvent.click(screen.getByRole("button", { name: "Add link" }));
  await userEvent.type(screen.getByLabelText("File path"), "notes.txt{Enter}");
  expect(screen.getByLabelText("File path")).toHaveValue("notes.txt");
  expect(await screen.findByText(/not a relative markdown file path/)).toBeInTheDocument();
});

test("remove dispatches removeCardLink", async () => {
  global.fetch = okFetch("x");
  const { executor } = renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Remove link Board UI plan" }));
  expect(executor.execute).toHaveBeenCalledWith("removeCardLink", { cardId: "card-3", linkId: "link-2" });
});

test("empty state", () => {
  global.fetch = vi.fn();
  renderWithBoard(<SpecTab card={findCard(board, "card-1").card} />, board);
  expect(screen.getByText("No linked files yet")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("links inside a rendered spec open in a new tab so the board is not lost", async () => {
  global.fetch = okFetch("[plan](2026-11-14-k-spec-board-ui-plan.md)");
  renderWithBoard(<SpecTab card={card3} />, board);
  const link = await screen.findByRole("link", { name: "plan" });
  expect(link).toHaveAttribute("href", "/files/docs/specs/2026-11-14-k-spec-board-ui-plan.md");
  expect(link).toHaveAttribute("target", "_blank");
});
