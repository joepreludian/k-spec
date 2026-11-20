import { DomainError } from "@/domain/errors.js";
import { CommandFailed, createHttpCommandExecutor } from "./http-command-executor.js";

const response = (status, body, { type = "application/json", redirected = false } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  redirected,
  headers: { get: (name) => (name.toLowerCase() === "content-type" ? type : null) },
  json: async () => body,
});
const executorAnswering = (res) => {
  const fetch = vi.fn(async () => res);
  return { fetch, executor: createHttpCommandExecutor({ fetch }) };
};

test("posts the input as json to the command's address and returns the answer", async () => {
  const { fetch, executor } = executorAnswering(response(200, { board: { id: "b" }, version: 4 }));
  const result = await executor.execute("updateCardTitle", { cardId: "c1", title: "New" });
  expect(result).toEqual({ board: { id: "b" }, version: 4 });
  expect(fetch).toHaveBeenCalledWith("/api/commands/updateCardTitle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: "c1", title: "New" }),
  });
});

test("no input is sent as an empty object", async () => {
  const { fetch, executor } = executorAnswering(response(200, { board: {}, version: 1 }));
  await executor.execute("endWork");
  expect(fetch.mock.calls[0][1].body).toBe("{}");
});

test("a 422 is thrown as a DomainError with the server's message and code", async () => {
  const { executor } = executorAnswering(response(422, { error: "Title cannot be empty", code: "EMPTY_TITLE" }));
  const error = await executor.execute("createCard", {}).catch((e) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect(error.message).toBe("Title cannot be empty");
  expect(error.code).toBe("EMPTY_TITLE");
});

test.each([
  ["a 500", response(500, { error: "Command failed" })],
  ["a 404", response(404, { error: "Unknown command" })],
  ["a redirect to the access page", response(200, {}, { redirected: true })],
  ["a 200 that is not json", response(200, {}, { type: "text/html; charset=utf-8" })],
  ["a 200 with no content type", response(200, {}, { type: null })],
])("%s is a CommandFailed, not a result", async (_, res) => {
  const { executor } = executorAnswering(res);
  const error = await executor.execute("createCard", {}).catch((e) => e);
  expect(error).toBeInstanceOf(CommandFailed);
  expect(error).not.toBeInstanceOf(DomainError);
  expect(error.message).toBe("Could not save the change");
});

test("an unreachable server is a CommandFailed", async () => {
  const executor = createHttpCommandExecutor({
    fetch: async () => {
      throw new TypeError("offline");
    },
  });
  await expect(executor.execute("createCard", {})).rejects.toBeInstanceOf(CommandFailed);
});

// --- a caller outside the browser (the CLI) ---------------------------------

const remote = (fetch) => createHttpCommandExecutor({ fetch, baseUrl: "http://k.test", token: "tok" });

test("a remote caller sends the base URL, the token cookie and refuses redirects", async () => {
  const fetch = vi.fn(async () => response(200, { version: 2 }));
  await remote(fetch).execute("endWork", { cardId: "c" });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("http://k.test/api/commands/endWork");
  expect(options.headers).toEqual({ "Content-Type": "application/json", Cookie: "k-spec-token=tok" });
  expect(options.redirect).toBe("manual");
});

test("the browser's request is unchanged", async () => {
  const fetch = vi.fn(async () => response(200, {}));
  await createHttpCommandExecutor({ fetch }).execute("endWork", {});
  expect(fetch.mock.calls[0]).toEqual([
    "/api/commands/endWork",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  ]);
});

test.each([
  ["unreachable", async () => { throw new TypeError("refused"); }],
  ["rejected", async () => response(307, null, { type: null })],
  ["rejected", async () => response(200, {}, { redirected: true })],
  ["unexpected", async () => response(200, {}, { type: "text/html" })],
  ["unexpected", async () => response(500, { error: "Command failed" })],
])("a failure says why: %s", async (reason, fetch) => {
  const failure = { name: "CommandFailed", reason, message: "Could not save the change" };
  await expect(remote(fetch).execute("endWork", {})).rejects.toMatchObject(failure);
  await expect(remote(fetch).getBoard()).rejects.toMatchObject({ name: "CommandFailed", reason });
});

test("a command the server does not know is told apart", async () => {
  const fetch = async () => response(404, { error: "Unknown command: nope" });
  await expect(remote(fetch).execute("nope", {})).rejects.toMatchObject({ reason: "unknown-command" });
  await expect(remote(fetch).getBoard()).rejects.toMatchObject({ reason: "unexpected" });
});

test("getBoard asks for the board with the token and resolves it with its version", async () => {
  const fetch = vi.fn(async () => response(200, { board: { id: "b" }, version: 3 }));
  expect(await remote(fetch).getBoard()).toEqual({ board: { id: "b" }, version: 3 });
  expect(fetch.mock.calls[0]).toEqual([
    "http://k.test/api/board",
    { headers: { Cookie: "k-spec-token=tok" }, redirect: "manual" },
  ]);
});

test("getBoard refuses an answer without a board", async () => {
  for (const body of [{ hello: 1 }, { board: null, version: 1 }, { board: "x" }, null]) {
    await expect(remote(async () => response(200, body)).getBoard()).rejects.toMatchObject({ reason: "unexpected" });
  }
});

test("an answer that claims json but is not is unexpected", async () => {
  const broken = { ...response(200, {}), json: async () => { throw new SyntaxError("bad json"); } };
  await expect(remote(async () => broken).execute("endWork", {})).rejects.toMatchObject({ reason: "unexpected" });
  await expect(remote(async () => broken).getBoard()).rejects.toMatchObject({ reason: "unexpected" });
});

test("getVersion asks the version endpoint with the token and resolves the number", async () => {
  const fetch = vi.fn(async () => response(200, { version: 7 }));
  expect(await remote(fetch).getVersion()).toBe(7);
  expect(fetch.mock.calls[0]).toEqual([
    "http://k.test/api/board/version",
    { headers: { Cookie: "k-spec-token=tok" }, redirect: "manual" },
  ]);
});

test("getVersion says why it failed, like every other call", async () => {
  for (const body of [{}, { version: "7" }, { version: 1.5 }, null]) {
    await expect(remote(async () => response(200, body)).getVersion()).rejects.toMatchObject({ reason: "unexpected" });
  }
  await expect(remote(async () => response(307, null, { type: null })).getVersion()).rejects.toMatchObject({ reason: "rejected" });
  const down = async () => {
    throw new TypeError("refused");
  };
  await expect(remote(down).getVersion()).rejects.toMatchObject({ reason: "unreachable" });
  await expect(remote(async () => response(404, { error: "Not found" })).getVersion()).rejects.toMatchObject({ reason: "unexpected" });
});
