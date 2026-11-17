import { act, renderHook } from "@testing-library/react";
import { boardOf, installBoardServer } from "@/test/board-server.js";
import { BOARD_POLL_INTERVAL_MS, useRemoteBoard } from "./use-remote-board.js";

const A = boardOf({ todo: ["1:Alpha"] });
const B = boardOf({ todo: ["1:Alpha", "2:Beta"] });
const tick = (ms = BOARD_POLL_INTERVAL_MS) => act(() => vi.advanceTimersByTimeAsync(ms));
const setHidden = (hidden) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  delete document.hidden;
  vi.useRealTimers();
});

test("polls every 10 seconds", () => {
  expect(BOARD_POLL_INTERVAL_MS).toBe(10000);
});

test("starts loading, then is ready with the board and version", async () => {
  installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  expect(result.current).toEqual({ status: "loading", board: null, version: null, error: null });
  await tick(0);
  expect(result.current).toEqual({ status: "ready", board: A, version: "v1", error: null });
  expect(globalThis.fetch).toHaveBeenCalledWith("/api/board", { cache: "no-store" });
});

test("an unchanged version does not reload the board", async () => {
  const server = installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  const loaded = result.current.board;
  await tick();
  await tick();
  await tick();
  expect(server.calls("/api/board/version")).toBe(3);
  expect(server.calls("/api/board")).toBe(1);
  expect(result.current.board).toBe(loaded);
});

test("a changed version reloads the board", async () => {
  const server = installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.serve(B, "v2");
  await tick();
  expect(result.current).toEqual({ status: "ready", board: B, version: "v2", error: null });
  await tick();
  expect(server.calls("/api/board")).toBe(2);
});

test("a first load that fails with 422 is an error naming the file, and recovers when the files change", async () => {
  const server = installBoardServer(A, "v1");
  server.breakWith("card.yaml is missing", "lanes/todo/1_x/card.yaml", "bad");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  expect(result.current).toEqual({
    status: "error",
    board: null,
    version: null,
    error: { message: "card.yaml is missing", file: "lanes/todo/1_x/card.yaml" },
  });
  await tick();
  expect(server.calls("/api/board")).toBe(1); // same broken version: not retried
  server.serve(A, "v2");
  await tick();
  expect(result.current).toEqual({ status: "ready", board: A, version: "v2", error: null });
});

test("a first load that cannot reach the server is an error and is retried on the next tick", async () => {
  const server = installBoardServer(A, "v1");
  server.offline = true;
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  expect(result.current.status).toBe("error");
  expect(result.current.error).toEqual({ message: "Could not load the board", file: null });
  server.offline = false;
  await tick();
  expect(result.current).toEqual({ status: "ready", board: A, version: "v1", error: null });
});

test("a refresh that fails with 422 keeps the board and reports the error; a later good load clears it", async () => {
  const server = installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.breakWith("Invalid YAML", "lanes/todo/1_x/card.yaml", "half-written");
  await tick();
  expect(result.current).toEqual({
    status: "ready",
    board: A,
    version: "v1",
    error: { message: "Invalid YAML", file: "lanes/todo/1_x/card.yaml" },
  });
  server.serve(B, "v3");
  await tick();
  expect(result.current).toEqual({ status: "ready", board: B, version: "v3", error: null });
});

test("a refresh that cannot reach the server changes nothing", async () => {
  const server = installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.offline = true;
  await tick();
  expect(result.current).toEqual({ status: "ready", board: A, version: "v1", error: null });
});

test("does not ask while the tab is hidden, and asks as soon as it is visible again", async () => {
  const server = installBoardServer(A, "v1");
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  setHidden(true);
  server.serve(B, "v2");
  await tick();
  await tick();
  expect(server.calls("/api/board/version")).toBe(0);
  setHidden(false);
  await tick(0);
  expect(result.current.board).toEqual(B);
});

test("stops asking after unmount", async () => {
  const server = installBoardServer(A, "v1");
  const { unmount } = renderHook(() => useRemoteBoard());
  await tick(0);
  unmount();
  await tick();
  setHidden(false);
  await tick(0);
  expect(server.calls("/api/board/version")).toBe(0);
});
