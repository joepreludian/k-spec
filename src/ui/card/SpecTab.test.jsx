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

test("shows a tile per link and fetches nothing until one is opened", () => {
  global.fetch = vi.fn();
  renderWithBoard(<SpecTab card={card3} />, board);
  expect(screen.getByRole("button", { name: "Board UI design" })).toHaveAttribute(
    "title",
    "docs/specs/2026-11-14-k-spec-board-ui-design.md",
  );
  expect(screen.getByRole("button", { name: "Board UI plan" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Files" })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("clicking a tile shows that document in place of the grid", async () => {
  global.fetch = okFetch("# Plan doc");
  renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Board UI plan" }));
  expect(await screen.findByRole("heading", { name: "Plan doc" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("/api/files/docs/specs/2026-11-14-k-spec-board-ui-plan.md", expect.anything());
  expect(screen.getByText("docs/specs/2026-11-14-k-spec-board-ui-plan.md")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open in new tab/ })).toHaveAttribute(
    "href",
    "/files/docs/specs/2026-11-14-k-spec-board-ui-plan.md",
  );
  expect(screen.queryByRole("button", { name: "Board UI design" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
});

test("Files returns from the document to the grid", async () => {
  global.fetch = okFetch("# Plan doc");
  renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Board UI plan" }));
  await userEvent.click(screen.getByRole("button", { name: "Files" }));
  expect(screen.getByRole("button", { name: "Board UI design" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Plan doc" })).not.toBeInTheDocument();
});

test("a file that fails to load still offers the way back", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "File not found" }) });
  renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Board UI plan" }));
  expect(await screen.findByText("Not found")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
});

test("falls back to the grid when the open link is removed from the card", async () => {
  global.fetch = okFetch("# Plan doc");
  const { rerender } = renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Board UI plan" }));
  rerender(<SpecTab card={{ ...card3, links: card3.links.filter((l) => l.id !== "link-2") }} />);
  expect(screen.getByRole("button", { name: "Board UI design" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Files" })).not.toBeInTheDocument();
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

test("remove dispatches removeCardLink without opening the file", async () => {
  global.fetch = vi.fn();
  const { executor } = renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Remove link Board UI plan" }));
  expect(executor.execute).toHaveBeenCalledWith("removeCardLink", { cardId: "card-3", linkId: "link-2" });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Files" })).not.toBeInTheDocument();
});

test("empty state", () => {
  global.fetch = vi.fn();
  renderWithBoard(<SpecTab card={findCard(board, "card-1").card} />, board);
  expect(screen.getByText("No linked files yet")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add link" })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("links inside a rendered spec open in a new tab so the board is not lost", async () => {
  global.fetch = okFetch("[plan](2026-11-14-k-spec-board-ui-plan.md)");
  renderWithBoard(<SpecTab card={card3} />, board);
  await userEvent.click(screen.getByRole("button", { name: "Board UI design" }));
  const link = await screen.findByRole("link", { name: "plan" });
  expect(link).toHaveAttribute("href", "/files/docs/specs/2026-11-14-k-spec-board-ui-plan.md");
  expect(link).toHaveAttribute("target", "_blank");
});

test("opening a tile with the keyboard moves focus to Files", async () => {
  global.fetch = okFetch("# Plan doc");
  renderWithBoard(<SpecTab card={card3} />, board);
  screen.getByRole("button", { name: "Board UI plan" }).focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Files" })).toHaveFocus();
});

test("going back returns focus to the tile that was open", async () => {
  global.fetch = okFetch("# Plan doc");
  renderWithBoard(<SpecTab card={card3} />, board);
  screen.getByRole("button", { name: "Board UI plan" }).focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Board UI plan" })).toHaveFocus();
});
