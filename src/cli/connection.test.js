// @vitest-environment node
import { ConnectionError, resolveConnection } from "./connection.js";

const FILE = "/p/data/k-spec.server.json";
const note = (value) => () => (value === null ? null : typeof value === "string" ? value : JSON.stringify(value));
const resolve = (env, value) => resolveConnection({ env, noteFile: FILE, readFile: note(value) });

test("K_SPEC_URL with K_SPEC_TOKEN wins over the note", () => {
  expect(
    resolve({ K_SPEC_URL: "http://h:1/", K_SPEC_TOKEN: "e" }, { url: "http://localhost:3000", token: "n" }),
  ).toEqual({ url: "http://h:1", token: "e" });
});

test("K_SPEC_URL without a token is an error naming it", () => {
  expect(() => resolve({ K_SPEC_URL: "http://h:1" }, { url: "u", token: "n" })).toThrow(
    "K_SPEC_URL is set but K_SPEC_TOKEN is not",
  );
  expect(() => resolve({ K_SPEC_URL: "http://h:1", K_SPEC_TOKEN: " " }, null)).toThrow(ConnectionError);
});

test("a lone K_SPEC_TOKEN is the server's own setting and is ignored", () => {
  const stored = { url: "http://localhost:3000", token: "n" };
  expect(resolve({ K_SPEC_TOKEN: "server-side" }, stored)).toEqual(stored);
  expect(resolve({ K_SPEC_URL: "", K_SPEC_TOKEN: "server-side" }, stored)).toEqual(stored);
  expect(resolve({ K_SPEC_URL: "  " }, stored)).toEqual(stored);
});

test("the note is read from the file it was told", () => {
  const readFile = vi.fn(() => JSON.stringify({ url: "http://localhost:3000/", token: "n", pid: 4 }));
  expect(resolveConnection({ env: {}, noteFile: FILE, readFile })).toEqual({ url: "http://localhost:3000", token: "n" });
  expect(readFile).toHaveBeenCalledWith(FILE);
});

test("no note means the server is not running, with what to do", () => {
  expect(() => resolve({}, null)).toThrow(
    "server not running (no /p/data/k-spec.server.json; start it with npm run dev, or set K_SPEC_URL and K_SPEC_TOKEN)",
  );
  expect(() => resolve({}, null)).toThrow(ConnectionError);
});

test.each(["not json", "[]", "null", '{"url":"http://x"}', '{"token":"t"}', '{"url":"","token":"t"}', '{"url":1,"token":"t"}'])(
  "a broken note names the file: %s",
  (text) => expect(() => resolve({}, text)).toThrow("cannot read the server note: /p/data/k-spec.server.json"),
);

test("a note that cannot be opened is a connection problem naming the file", () => {
  const readFile = () => {
    throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
  };
  const attempt = () => resolveConnection({ env: {}, noteFile: FILE, readFile });
  expect(attempt).toThrow(ConnectionError);
  expect(attempt).toThrow("cannot read the server note: /p/data/k-spec.server.json");
});

test.each(["not a url", "localhost:3999", "ftp://h/x", "//h:1"])("K_SPEC_URL must be an http(s) address: %s", (url) => {
  const attempt = () => resolve({ K_SPEC_URL: url, K_SPEC_TOKEN: "t" }, null);
  expect(attempt).toThrow(ConnectionError);
  expect(attempt).toThrow("K_SPEC_URL is not an http(s) address");
});

test("a pasted access link is cut down to the address, so the token in it is never printed", () => {
  expect(resolve({ K_SPEC_URL: "http://h:3000/?token=SECRET#x", K_SPEC_TOKEN: "t" }, null)).toEqual({ url: "http://h:3000", token: "t" });
  expect(resolve({ K_SPEC_URL: "https://h/base/", K_SPEC_TOKEN: "t" }, null).url).toBe("https://h/base");
  expect(() => resolve({ K_SPEC_URL: "http://h:3000/?token=SECRET", K_SPEC_TOKEN: "" }, null)).toThrow(
    "K_SPEC_URL is set but K_SPEC_TOKEN is not",
  );
});

test("a note with an address that is not http(s) cannot be used", () => {
  expect(() => resolve({}, { url: "ftp//x", token: "t" })).toThrow("cannot read the server note: /p/data/k-spec.server.json");
});

test("only the note's problems can heal while a command waits", () => {
  const transient = (env, value) => {
    try {
      resolve(env, value);
    } catch (error) {
      return error.transient;
    }
    return "no error";
  };
  expect(transient({}, null)).toBe(true); // the server has not started yet
  expect(transient({}, "{ half a no")).toBe(true); // the server is writing it
  expect(transient({ K_SPEC_URL: "http://h:1" }, null)).toBe(false);
  expect(transient({ K_SPEC_URL: "ftp://h", K_SPEC_TOKEN: "t" }, null)).toBe(false);
});
