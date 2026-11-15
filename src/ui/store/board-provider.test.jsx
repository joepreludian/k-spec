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

test("non-domain errors are rethrown", async () => {
  const executor = { execute: vi.fn().mockRejectedValue(new Error("boom")) };
  let caught;
  function Thrower() {
    const { dispatch } = useBoard();
    return (
      <button onClick={() => dispatch("getBoard", {}).catch((e) => (caught = e))}>go</button>
    );
  }
  render(
    <BoardProvider executor={executor} initialBoard={b}>
      <Thrower />
    </BoardProvider>,
  );
  await userEvent.click(screen.getByText("go"));
  await waitFor(() => expect(caught?.message).toBe("boom"));
  expect(toast.error).not.toHaveBeenCalled();
});

test("useBoard outside provider throws", () => {
  function Bare() {
    useBoard();
    return null;
  }
  expect(() => render(<Bare />)).toThrow(/BoardProvider/);
});
