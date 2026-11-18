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
