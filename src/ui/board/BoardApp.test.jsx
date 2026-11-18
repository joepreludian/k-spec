import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { boardOf, installBoardServer } from "@/test/board-server.js";
import { BoardApp } from "./BoardApp.jsx";

const A = boardOf({ Backlog: [], Todo: ["1:Alpha"] });
const B = boardOf({ Backlog: [], Todo: ["1:Alpha", "2:Beta"] });
const lane = (name) => screen.getByRole("region", { name });
const tileNamed = (re) => screen.getByRole("button", { name: (n) => re.test(n) && !n.startsWith("Drag card") });
const renderApp = () =>
  render(
    <TooltipProvider>
      <BoardApp />
      <Toaster />
    </TooltipProvider>,
  );
/** Makes the app ask the server whether the board changed, as the poll or a tab switch would. */
const refresh = () => act(async () => void document.dispatchEvent(new Event("visibilitychange")));
const addCard = async (laneName, title) => {
  await userEvent.click(within(lane(laneName)).getByRole("button", { name: "+ Card" }));
  await userEvent.type(within(lane(laneName)).getByLabelText("Card title"), `${title}{Enter}`);
};

test("shows a loading line, then the board from the server", async () => {
  installBoardServer(A);
  renderApp();
  expect(screen.getByText("Loading board…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { level: 1, name: "Test board" })).toBeInTheDocument();
  expect(within(lane("Todo")).getByText("Alpha")).toBeInTheDocument();
  expect(screen.queryByText("Loading board…")).not.toBeInTheDocument();
});

test("a server that cannot be reached shows the error page, not a board", async () => {
  const server = installBoardServer(A);
  server.offline = true;
  renderApp();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the board");
  expect(screen.queryByRole("region", { name: "Todo" })).not.toBeInTheDocument();
});

test("an edit is sent to the server and the server's answer is shown, without reloading the board", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  await addCard("Backlog", "Saved card");
  expect(await within(lane("Backlog")).findByText("Saved card")).toBeInTheDocument();
  expect(server.calls("/api/commands/createCard")).toBe(1);
  const stored = await server.repository.load();
  expect(stored.lanes[0].cards.map((c) => c.title)).toEqual(["Saved card"]);

  await refresh();
  await waitFor(() => expect(server.calls("/api/board/version")).toBe(1));
  expect(server.calls("/api/board")).toBe(1);
  expect(within(lane("Backlog")).getByText("Saved card")).toBeInTheDocument();
});

test("a change made by someone else appears after the next check, and later edits build on it", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  server.serve(B, 2);
  await refresh();
  expect(await screen.findByText("Beta")).toBeInTheDocument();

  await addCard("Backlog", "After refresh");
  expect(await screen.findByText("After refresh")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect((await server.repository.load()).lanes[1].cards.map((c) => c.title)).toEqual(["Alpha", "Beta"]);
});

test("a rule the server refuses shows its message and changes nothing", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  await userEvent.click(tileNamed(/Alpha/));
  const dialog = await screen.findByRole("dialog");
  server.serve(boardOf({ Backlog: [], Todo: [] }), 2); // the card is gone on the server
  await userEvent.click(within(dialog).getByRole("button", { name: /\+ Checklist/ }));
  await userEvent.type(within(dialog).getByLabelText(/checklist title/i), "Steps{Enter}");
  expect(await screen.findByText(/Card "card-1" not found/)).toBeInTheDocument();
});

test("a server that stops answering shows that the change was not saved and keeps the board", async () => {
  const server = installBoardServer(A);
  renderApp();
  await screen.findByText("Alpha");
  server.offline = true;
  await addCard("Backlog", "Lost");
  expect(await screen.findByText("Could not save the change")).toBeInTheDocument();
  expect(screen.queryByText("Lost")).not.toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
});

test("an open card stays open across a refresh that keeps it, and closes when the card is gone", async () => {
  const server = installBoardServer(B);
  renderApp();
  await screen.findByText("Beta");
  await userEvent.click(tileNamed(/Beta/));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  server.serve(boardOf({ Backlog: [], Todo: ["1:Alpha", "2:Beta renamed"] }), 2);
  await refresh();
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Beta renamed")).toBeInTheDocument());

  server.serve(A, 3);
  await refresh();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
