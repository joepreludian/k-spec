import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { boardOf, installBoardServer } from "@/test/board-server.js";
import { BoardApp } from "./BoardApp.jsx";

const A = boardOf({ todo: ["1:Alpha"] });
const B = boardOf({ todo: ["1:Alpha", "2:Beta"] });
const lane = (name) => screen.getByRole("region", { name });
const tileNamed = (re) => screen.getByRole("button", { name: (n) => re.test(n) && !n.startsWith("Drag card") });
const renderApp = () =>
  render(
    <TooltipProvider>
      <BoardApp />
    </TooltipProvider>,
  );
/** Makes the app ask the server whether the board changed, as the poll or a tab switch would. */
const refresh = () => act(async () => void document.dispatchEvent(new Event("visibilitychange")));

test("shows a loading line, then the board read from the server", async () => {
  installBoardServer(A);
  renderApp();
  expect(screen.getByText("Loading board…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { level: 1, name: "Disk board" })).toBeInTheDocument();
  expect(within(lane("Todo")).getByText("Alpha")).toBeInTheDocument();
  expect(screen.queryByText("Loading board…")).not.toBeInTheDocument();
});

test("a first load with a broken file shows the error and the file, not a board", async () => {
  const server = installBoardServer(A);
  server.breakWith("Card has no title", "lanes/todo/1_x/card.yaml", "bad");
  renderApp();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Card has no title");
  expect(alert).toHaveTextContent("lanes/todo/1_x/card.yaml");
  expect(screen.queryByRole("region", { name: "Todo" })).not.toBeInTheDocument();
});

test("shows the new board when the files change", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  server.serve(B, "v2");
  await refresh();
  expect(await screen.findByText("Beta")).toBeInTheDocument();
});

test("a broken file during a refresh keeps the board and adds a banner, which a good load removes", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  server.breakWith("Invalid YAML", "lanes/todo/1_x/card.yaml", "half");
  await refresh();
  const banner = await screen.findByRole("status", { name: "Board not refreshed" });
  expect(banner).toHaveTextContent("Invalid YAML");
  expect(banner).toHaveTextContent("lanes/todo/1_x/card.yaml");
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  server.serve(B, "v3");
  await refresh();
  await screen.findByText("Beta");
  expect(screen.queryByRole("status", { name: "Board not refreshed" })).not.toBeInTheDocument();
});

test("edits made in the browser are replaced by a refresh, and later edits build on the refreshed board", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  await userEvent.click(within(lane("Todo")).getByRole("button", { name: "+ Card" }));
  await userEvent.type(screen.getByLabelText("Card title"), "Local only{Enter}");
  expect(await screen.findByText("Local only")).toBeInTheDocument();

  server.serve(B, "v2");
  await refresh();
  await screen.findByText("Beta");
  expect(screen.queryByText("Local only")).not.toBeInTheDocument();

  await userEvent.click(within(lane("Backlog")).getByRole("button", { name: "+ Card" }));
  await userEvent.type(within(lane("Backlog")).getByLabelText("Card title"), "After refresh{Enter}");
  expect(await screen.findByText("After refresh")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.queryByText("Local only")).not.toBeInTheDocument();
});

test("an open card stays open across a refresh that keeps it, and closes when the card is gone", async () => {
  const server = installBoardServer(B);
  renderApp();
  await screen.findByText("Beta");
  await userEvent.click(tileNamed(/Beta/));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  server.serve(boardOf({ todo: ["1:Alpha", "2:Beta renamed"] }), "v2");
  await refresh();
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Beta renamed")).toBeInTheDocument());

  server.serve(A, "v3");
  await refresh();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
