import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityTab } from "./ActivityTab.jsx";
import { renderWithBoard } from "@/test/render-board.jsx";
import { seedBoard } from "@/infrastructure/seed-board.js";
import { findCard } from "@/domain/board.js";

const board = seedBoard();
// card-2: person comment (comment-2) then agent reply (comment-3), plus status/work events
const card = findCard(board, "card-2").card;
const bare = findCard(board, "card-8").card;

test("renders comments oldest first with author kind and name", () => {
  renderWithBoard(<ActivityTab card={card} />, board);
  const items = screen.getAllByRole("article");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveAttribute("data-author-kind", "person");
  expect(within(items[0]).getByText("You")).toBeInTheDocument();
  expect(items[1]).toHaveAttribute("data-author-kind", "agent");
  expect(within(items[1]).getByText("claude")).toBeInTheDocument();
  expect(within(items[1]).getByText(/LaneNotEmpty/)).toBeInTheDocument();
});

test("shows an empty hint when there is no activity", () => {
  renderWithBoard(<ActivityTab card={bare} />, board);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByText("No activity yet.")).toBeInTheDocument();
});

test("comment button is disabled while the composer is blank", async () => {
  renderWithBoard(<ActivityTab card={bare} />, board);
  const button = screen.getByRole("button", { name: "Comment" });
  expect(button).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Write a comment"), "   ");
  expect(button).toBeDisabled();
});

test("submitting dispatches addComment as the person and clears", async () => {
  const { executor } = renderWithBoard(<ActivityTab card={bare} />, board);
  const composer = screen.getByLabelText("Write a comment");
  await userEvent.type(composer, "Please add tests");
  await userEvent.click(screen.getByRole("button", { name: "Comment" }));
  expect(executor.execute).toHaveBeenCalledWith("addComment", { cardId: "card-8", body: "Please add tests" });
  expect(composer).toHaveValue("");
});

test("dev-only 'Post as agent' toggle sends an agent author", async () => {
  const { executor } = renderWithBoard(<ActivityTab card={bare} />, board);
  await userEvent.click(screen.getByRole("checkbox", { name: "Post as agent" }));
  await userEvent.type(screen.getByLabelText("Write a comment"), "On it");
  await userEvent.click(screen.getByRole("button", { name: "Comment" }));
  expect(executor.execute).toHaveBeenCalledWith("addComment", {
    cardId: "card-8",
    body: "On it",
    author: { kind: "agent", name: "claude" },
  });
});

test("renders events as muted one-liners in time order with the comments", () => {
  renderWithBoard(<ActivityTab card={findCard(board, "card-3").card} />, board);
  const list = screen.getByRole("list", { name: "Activity" });
  const texts = within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(texts[0]).toMatch(/^Status changed to working · /);
  expect(texts.some((t) => /^Work started on host \/ main · /.test(t))).toBe(true);
  expect(texts.some((t) => /^Work ended · /.test(t))).toBe(true);
  expect(texts.some((t) => /^Work started on lima \/ feat\/watcher · /.test(t))).toBe(true);
  expect(texts.some((t) => /Watcher prototype running/.test(t))).toBe(true);
  expect(texts.indexOf(texts.find((t) => /^Work ended/.test(t)))).toBeGreaterThan(texts.indexOf(texts.find((t) => /on host/.test(t))));
});
