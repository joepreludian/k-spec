import { act, renderHook } from "@testing-library/react";
import { boardOf, installBoardServer } from "@/test/board-server.js";
import { BOARD_POLL_INTERVAL_MS, useRemoteBoard } from "./use-remote-board.js";

const A = boardOf({ Todo: ["1:Alpha"] });
const B = boardOf({ Todo: ["1:Alpha", "2:Beta"] });
const C = boardOf({ Todo: ["1:Alpha", "2:Beta", "3:Gamma"] });
const tick = (ms = BOARD_POLL_INTERVAL_MS) => act(() => vi.advanceTimersByTimeAsync(ms));
const setHidden = (hidden) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};
const ready = (board, version) => ({ status: "ready", board, version, error: null });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  delete document.hidden;
  vi.useRealTimers();
});

test("polls every 10 seconds", () => {
  expect(BOARD_POLL_INTERVAL_MS).toBe(10000);
});

test("starts loading, then is ready with the board and version", async () => {
  installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  expect(result.current).toMatchObject({ status: "loading", board: null, version: null, error: null });
  await tick(0);
  expect(result.current).toMatchObject(ready(A, 1));
  expect(globalThis.fetch).toHaveBeenCalledWith("/api/board", { cache: "no-store" });
});

test("an unchanged version does not reload the board", async () => {
  const server = installBoardServer(A, 1);
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
  const server = installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.serve(B, 2);
  await tick();
  expect(result.current).toMatchObject(ready(B, 2));
  await tick();
  expect(server.calls("/api/board")).toBe(2);
});

test("a version that went down (a new database) reloads too", async () => {
  const server = installBoardServer(B, 57);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.serve(A, 1);
  await tick();
  expect(result.current).toMatchObject(ready(A, 1));
});

test("a first load that cannot reach the server is an error and is retried on the next tick", async () => {
  const server = installBoardServer(A, 1);
  server.offline = true;
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  expect(result.current.status).toBe("error");
  expect(result.current.error).toEqual({ message: "Could not load the board" });
  server.offline = false;
  await tick();
  expect(result.current).toMatchObject(ready(A, 1));
});

test("a refresh that cannot reach the server changes nothing", async () => {
  const server = installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.offline = true;
  await tick();
  expect(result.current).toMatchObject(ready(A, 1));
});

test("does not ask while the tab is hidden, and asks as soon as it is visible again", async () => {
  const server = installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  setHidden(true);
  server.serve(B, 2);
  await tick();
  await tick();
  expect(server.calls("/api/board/version")).toBe(0);
  setHidden(false);
  await tick(0);
  expect(result.current.board).toEqual(B);
});

test("stops asking after unmount", async () => {
  const server = installBoardServer(A, 1);
  const { unmount } = renderHook(() => useRemoteBoard());
  await tick(0);
  unmount();
  await tick();
  setHidden(false);
  await tick(0);
  expect(server.calls("/api/board/version")).toBe(0);
});

test("accepting a command's answer shows its board, and the next poll does not reload", async () => {
  const server = installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.serve(B, 2); // what the server holds after our command
  let shown;
  act(() => {
    shown = result.current.accept({ board: B, version: 2 });
  });
  expect(shown).toBe(B);
  expect(result.current).toMatchObject(ready(B, 2));
  await tick();
  expect(server.calls("/api/board")).toBe(1);
});

test("accept keeps the same function across renders", async () => {
  installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  const first = result.current.accept;
  await tick(0);
  expect(result.current.accept).toBe(first);
});

test("an older command answer does not replace a newer board, and the board is checked again", async () => {
  const server = installBoardServer(B, 2);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  let shown;
  act(() => {
    shown = result.current.accept({ board: A, version: 1 });
  });
  expect(shown).toEqual(B);
  await tick(0);
  expect(result.current).toMatchObject(ready(B, 2));
  expect(server.calls("/api/board")).toBe(2);
});

test("a board answer that is older than an accepted command answer is discarded", async () => {
  const server = installBoardServer(A, 1);
  const { result } = renderHook(() => useRemoteBoard());
  await tick(0);
  server.serve(B, 2);
  const release = server.hold();
  await tick(); // the poll sees version 2; held
  release();
  const releaseBoard = server.hold();
  await tick(0); // version answered, /api/board (version 2) now in flight and held
  act(() => void result.current.accept({ board: C, version: 3 }));
  releaseBoard();
  await tick(0);
  expect(result.current).toMatchObject(ready(C, 3));
});
