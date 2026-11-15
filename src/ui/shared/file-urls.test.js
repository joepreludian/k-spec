import { apiFileUrl, filePageUrl } from "./file-urls.js";

test("encodes each segment", () => {
  expect(apiFileUrl("docs/my spec.md")).toBe("/api/files/docs/my%20spec.md");
  expect(filePageUrl("README.md")).toBe("/files/README.md");
  expect(filePageUrl("docs/a#b.md")).toBe("/files/docs/a%23b.md");
});
