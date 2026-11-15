import { assertHttpUrl, createService } from "./service.js";
import { InvalidLinkUrl } from "./errors.js";

test("createService keeps id, title and url", () => {
  expect(createService({ id: "s1", title: "Preview", url: "https://example.test/app" })).toEqual({
    id: "s1",
    title: "Preview",
    url: "https://example.test/app",
  });
});

test.each([
  ["http://localhost:8002/x", "localhost:8002"],
  ["http://lima-dev-k-spec-main.local:3000", "lima-dev-k-spec-main.local:3000"],
  ["https://example.test/", "example.test"],
])("a blank or missing title defaults to the host of %s", (url, host) => {
  expect(createService({ id: "s1", url }).title).toBe(host);
  expect(createService({ id: "s1", title: "   ", url }).title).toBe(host);
});

test.each([["javascript:alert(1)"], ["file:///etc/passwd"], ["/relative"], ["localhost:8002"], [""], [undefined], [42]])(
  "rejects %p as a service url",
  (url) => {
    expect(() => createService({ id: "s1", url })).toThrow(InvalidLinkUrl);
    expect(() => assertHttpUrl(url)).toThrow(InvalidLinkUrl);
  },
);

test("assertHttpUrl returns the url unchanged", () => {
  expect(assertHttpUrl("HTTP://Example.test:8080/a?b=1")).toBe("HTTP://Example.test:8080/a?b=1");
});

test.each([[" http://localhost:8002"], ["http://localhost:8002 "], ["\thttp://localhost:8002\n"]])(
  "rejects a url with surrounding whitespace: %j",
  (url) => {
    expect(() => assertHttpUrl(url)).toThrow(InvalidLinkUrl);
  },
);
