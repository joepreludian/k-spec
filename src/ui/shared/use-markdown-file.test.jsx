import { renderHook, waitFor } from "@testing-library/react";
import { useMarkdownFile } from "./use-markdown-file.js";

const ok = (content) => ({ ok: true, status: 200, json: async () => ({ path: "x", content }) });
const fail = (status) => ({ ok: false, status, json: async () => ({ error: "x" }) });

afterEach(() => {
  delete global.fetch;
});

test("loads content for a path", async () => {
  global.fetch = vi.fn().mockResolvedValue(ok("# hi"));
  const { result } = renderHook(() => useMarkdownFile("README.md"));
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("ok"));
  expect(result.current.content).toBe("# hi");
  expect(global.fetch).toHaveBeenCalledWith("/api/files/README.md", expect.objectContaining({ cache: "no-store" }));
});

test.each([
  [404, "Not found"],
  [403, "Not allowed"],
  [413, "Too large"],
  [500, "Could not load"],
])("maps %i to %s", async (status, text) => {
  global.fetch = vi.fn().mockResolvedValue(fail(status));
  const { result } = renderHook(() => useMarkdownFile("x.md"));
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.error).toBe(text);
});

test("network failure ends in Could not load", async () => {
  global.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
  const { result } = renderHook(() => useMarkdownFile("x.md"));
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.error).toBe("Could not load");
});

test("idle without a path", () => {
  global.fetch = vi.fn();
  expect(renderHook(() => useMarkdownFile(null)).result.current.status).toBe("idle");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("ignores a stale response when the path changes", async () => {
  let resolveFirst;
  global.fetch = vi
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
    .mockResolvedValueOnce(ok("second"));
  const { result, rerender } = renderHook(({ path }) => useMarkdownFile(path), { initialProps: { path: "a.md" } });
  rerender({ path: "b.md" });
  await waitFor(() => expect(result.current.content).toBe("second"));
  resolveFirst(ok("first"));
  await new Promise((r) => setTimeout(r, 0));
  expect(result.current.content).toBe("second");
});
