import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BoardProvider } from "./board-provider.jsx";
import { useBoard } from "./use-board.js";
import { createBoard } from "@/domain/board.js";
import { EmptyTitle } from "@/domain/errors.js";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const b = createBoard({ id: "b", name: "Board" });

function Probe() {
  const { board, dispatch, pending } = useBoard();
  const [lastId, setLastId] = useState("");
  return (
    <div>
      <span>{board.name}</span>
      <span data-testid="pending">{pending ? "pending" : "idle"}</span>
      <span data-testid="last-id">{lastId}</span>
      <button
        onClick={async () => {
          const result = await dispatch("createLane", { name: "QA" });
          setLastId(result?.id ?? "none");
        }}
      >
        add lane
      </button>
    </div>
  );
}

beforeEach(() => vi.clearAllMocks());

test("dispatch updates board from executor result and resolves with it", async () => {
  const executor = {
    execute: vi.fn().mockResolvedValue({ board: { ...b, name: "Renamed" }, id: "id-1" }),
  };
  render(
    <BoardProvider executor={executor} initialBoard={b}>
      <Probe />
    </BoardProvider>,
  );
  expect(screen.getByText("Board")).toBeInTheDocument();
  await userEvent.click(screen.getByText("add lane"));
  expect(executor.execute).toHaveBeenCalledWith("createLane", { name: "QA" });
  expect(await screen.findByText("Renamed")).toBeInTheDocument();
  expect(screen.getByTestId("last-id")).toHaveTextContent("id-1");
  expect(screen.getByTestId("pending")).toHaveTextContent("idle");
});

test("domain error shows toast, keeps state, resolves undefined", async () => {
  const executor = { execute: vi.fn().mockRejectedValue(new EmptyTitle()) };
  render(
    <BoardProvider executor={executor} initialBoard={b}>
      <Probe />
    </BoardProvider>,
  );
  await userEvent.click(screen.getByText("add lane"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/title/i)));
  expect(screen.getByText("Board")).toBeInTheDocument();
  expect(screen.getByTestId("last-id")).toHaveTextContent("none");
  expect(screen.getByTestId("pending")).toHaveTextContent("idle");
});

test("any other failure says the change was not saved, keeps the board, resolves undefined", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const executor = { execute: vi.fn().mockRejectedValue(new Error("boom")) };
  render(
    <BoardProvider executor={executor} initialBoard={b}>
      <Probe />
    </BoardProvider>,
  );
  await userEvent.click(screen.getByText("add lane"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save the change"));
  expect(screen.getByText("Board")).toBeInTheDocument();
  expect(screen.getByTestId("last-id")).toHaveTextContent("none");
  expect(screen.getByTestId("pending")).toHaveTextContent("idle");
  console.error.mockRestore();
});

test("useBoard outside provider throws", () => {
  function Bare() {
    useBoard();
    return null;
  }
  expect(() => render(<Bare />)).toThrow(/BoardProvider/);
});

test("a new initialBoard replaces the board being shown", () => {
  const executor = { execute: vi.fn() };
  const tree = (board) => (
    <BoardProvider executor={executor} initialBoard={board}>
      <Probe />
    </BoardProvider>
  );
  const { rerender } = render(tree(b));
  expect(screen.getByText("Board")).toBeInTheDocument();
  rerender(tree({ ...b, name: "Reloaded" }));
  expect(screen.getByText("Reloaded")).toBeInTheDocument();
  rerender(tree({ ...b, name: "Reloaded" }));
  expect(screen.getByText("Reloaded")).toBeInTheDocument();
});
