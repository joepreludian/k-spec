import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { boardOf, installBoardServer } from "@/test/board-server.js";
import Page from "./page";

const renderPage = () =>
  render(
    <TooltipProvider>
      <Page />
    </TooltipProvider>,
  );

test("renders the board name from the server as the heading", async () => {
  installBoardServer(boardOf({}, "k-spec"));
  renderPage();
  expect(await screen.findByRole("heading", { level: 1, name: "k-spec" })).toBeInTheDocument();
});

test("renders the lanes the server has", async () => {
  installBoardServer(boardOf({ Backlog: [], Done: [] }));
  renderPage();
  expect(await screen.findByText("Backlog")).toBeInTheDocument();
  expect(screen.getByText("Done")).toBeInTheDocument();
});
