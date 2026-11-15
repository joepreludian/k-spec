// @vitest-environment node
import { GET } from "./route.js";

const call = (segments) =>
  GET(new Request("http://localhost/api/files/" + segments.join("/")), { params: Promise.resolve({ path: segments }) });

test("serves README.md as JSON with no-store", async () => {
  const res = await call(["README.md"]);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json();
  expect(body.path).toBe("README.md");
  expect(body.content).toMatch(/^# k-spec/);
});

test("decodes segments and rejects traversal with 400", async () => {
  expect((await call(["%2e%2e", "x.md"])).status).toBe(400);
  expect((await call(["docs%2F..%2F..%2Fx.md"])).status).toBe(400);
  expect((await call(["package.json"])).status).toBe(400);
});

test("404 for a missing file", async () => {
  expect((await call(["nope.md"])).status).toBe(404);
});

test("reads from K_SPEC_PROJECT_DIR when set", async () => {
  process.env.K_SPEC_PROJECT_DIR = "/definitely/not/here";
  try {
    expect((await call(["README.md"])).status).toBe(404);
  } finally {
    delete process.env.K_SPEC_PROJECT_DIR;
  }
});
