import { act, renderHook, waitFor } from "@testing-library/react";
import { SERVICE_CHECK_INTERVAL_MS, SERVICE_CHECK_TIMEOUT_MS, useServiceStatus, useServiceStatuses } from "./use-service-status.js";

const URL_A = "http://localhost:8002";
const URL_B = "http://lima-dev.local:3000";
const up = () => Promise.resolve({ type: "opaque" });
const down = () => Promise.reject(new TypeError("Failed to fetch"));
/** Like a real fetch to a host that never answers: settles only when aborted. */
const hangs = (_url, { signal }) =>
  new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));

afterEach(() => {
  vi.useRealTimers();
  delete global.fetch;
});

test("starts as checking and turns online when the service answers, asking without CORS", async () => {
  global.fetch = vi.fn(up);
  const { result } = renderHook(() => useServiceStatus(URL_A));
  expect(result.current).toBe("checking");
  await waitFor(() => expect(result.current).toBe("online"));
  expect(global.fetch).toHaveBeenCalledWith(URL_A, expect.objectContaining({ mode: "no-cors", cache: "no-store" }));
});

test("turns offline when the request fails", async () => {
  global.fetch = vi.fn(down);
  const { result } = renderHook(() => useServiceStatus(URL_A));
  await waitFor(() => expect(result.current).toBe("offline"));
});

test("turns offline when nothing answers within the timeout", async () => {
  vi.useFakeTimers();
  global.fetch = vi.fn(hangs);
  const { result } = renderHook(() => useServiceStatus(URL_A));
  await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_TIMEOUT_MS - 1));
  expect(result.current).toBe("checking");
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(result.current).toBe("offline");
});

test("checks again on an interval and follows the service going down", async () => {
  vi.useFakeTimers();
  global.fetch = vi.fn().mockImplementationOnce(up).mockImplementation(down);
  const { result } = renderHook(() => useServiceStatus(URL_A));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(result.current).toBe("online");
  await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_INTERVAL_MS));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(result.current).toBe("offline");
});

test("a new url is checking until its own result arrives, never the old url's", async () => {
  let settleB;
  global.fetch = vi.fn((url) => (url === URL_A ? up() : new Promise((resolve) => (settleB = resolve))));
  const { result, rerender } = renderHook(({ url }) => useServiceStatus(url), { initialProps: { url: URL_A } });
  await waitFor(() => expect(result.current).toBe("online"));
  rerender({ url: URL_B });
  expect(result.current).toBe("checking");
  await act(async () => settleB({ type: "opaque" }));
  expect(result.current).toBe("online");
});

test("unmounting aborts the request and stops the interval", async () => {
  vi.useFakeTimers();
  const signals = [];
  global.fetch = vi.fn((url, init) => {
    signals.push(init.signal);
    return hangs(url, init);
  });
  const { unmount } = renderHook(() => useServiceStatus(URL_A));
  unmount();
  expect(signals[0].aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_INTERVAL_MS * 2));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("without a url nothing is requested", () => {
  global.fetch = vi.fn(up);
  const { result } = renderHook(() => useServiceStatus(null));
  expect(result.current).toBe("offline");
  expect(global.fetch).not.toHaveBeenCalled();
});

describe("shared between everything showing the same url", () => {
  test("two users of one url cause one request and see the same answer", async () => {
    global.fetch = vi.fn(up);
    const a = renderHook(() => useServiceStatus(URL_A));
    const b = renderHook(() => useServiceStatus(URL_A));
    await waitFor(() => expect(a.result.current).toBe("online"));
    expect(b.result.current).toBe("online");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("a latecomer gets the known status at once instead of checking again", async () => {
    global.fetch = vi.fn(up);
    const first = renderHook(() => useServiceStatus(URL_A));
    await waitFor(() => expect(first.result.current).toBe("online"));
    const late = renderHook(() => useServiceStatus(URL_A));
    expect(late.result.current).toBe("online");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("checks continue while anyone is left and stop when the last one leaves", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn(up);
    const a = renderHook(() => useServiceStatus(URL_A));
    const b = renderHook(() => useServiceStatus(URL_A));
    await act(() => vi.advanceTimersByTimeAsync(0));
    a.unmount();
    await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_INTERVAL_MS));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(b.result.current).toBe("online");
    b.unmount();
    await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_INTERVAL_MS * 2));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("the status holds during a re-check instead of flashing back to checking", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockImplementationOnce(up).mockImplementation(hangs);
    const { result } = renderHook(() => useServiceStatus(URL_A));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_INTERVAL_MS));
    expect(result.current).toBe("online");
    await act(() => vi.advanceTimersByTimeAsync(SERVICE_CHECK_TIMEOUT_MS));
    expect(result.current).toBe("offline");
  });
});

describe("useServiceStatuses", () => {
  test("returns one status per url, in order, each checked on its own", async () => {
    global.fetch = vi.fn((url) => (url === URL_A ? up() : down()));
    const { result } = renderHook(() => useServiceStatuses([URL_A, URL_B]));
    expect(result.current).toEqual(["checking", "checking"]);
    await waitFor(() => expect(result.current).toEqual(["online", "offline"]));
  });

  test("an empty list checks nothing", () => {
    global.fetch = vi.fn(up);
    const { result } = renderHook(() => useServiceStatuses([]));
    expect(result.current).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
