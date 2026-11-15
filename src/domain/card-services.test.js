import { createCard, endWork, publishService, startWork, unpublishService } from "./card.js";
import { DuplicateService, InvalidLinkUrl, NoActiveWork, ServiceNotFound } from "./errors.js";

const T0 = "2026-11-14T10:00:00.000Z";
const T1 = "2026-11-14T11:00:00.000Z";
const bare = () => createCard({ id: "c1", number: 1, title: "Card", now: T0 });
const working = () => startWork(bare(), { location: { kind: "lima", name: "lima-dev" }, branch: "feat/x" }, T0);
const lima = { id: "s1", url: "http://lima-dev.local:3000" };

test("new work starts with no services", () => {
  expect(working().work.services).toEqual([]);
});

test("publishService appends to the active work and touches the card without mutating it", () => {
  const before = working();
  const after = publishService(before, lima, T1);
  expect(after.work.services).toEqual([{ id: "s1", title: "lima-dev.local:3000", url: "http://lima-dev.local:3000" }]);
  expect(after.updatedAt).toBe(T1);
  expect(before.work.services).toEqual([]);
  expect(before.updatedAt).toBe(T0);
});

test("publishService keeps a given title and the order of publication", () => {
  let c = publishService(working(), lima, T1);
  c = publishService(c, { id: "s2", title: "API", url: "http://localhost:8002" }, T1);
  expect(c.work.services.map((s) => s.title)).toEqual(["lima-dev.local:3000", "API"]);
});

test("publishService needs active work, a valid url and a url not yet published", () => {
  expect(() => publishService(bare(), lima, T1)).toThrow(NoActiveWork);
  expect(() => publishService(working(), { id: "s1", url: "javascript:alert(1)" }, T1)).toThrow(InvalidLinkUrl);
  const c = publishService(working(), lima, T1);
  expect(() => publishService(c, { id: "s2", url: lima.url }, T1)).toThrow(DuplicateService);
});

test("unpublishService removes the service and touches the card", () => {
  const c = publishService(publishService(working(), lima, T0), { id: "s2", url: "http://localhost:8002" }, T0);
  const after = unpublishService(c, "s1", T1);
  expect(after.work.services.map((s) => s.id)).toEqual(["s2"]);
  expect(after.updatedAt).toBe(T1);
  expect(c.work.services).toHaveLength(2);
});

test("unpublishService needs active work and a known id", () => {
  expect(() => unpublishService(bare(), "s1", T1)).toThrow(NoActiveWork);
  expect(() => unpublishService(working(), "nope", T1)).toThrow(ServiceNotFound);
});

test("ending work archives its services with it", () => {
  const ended = endWork(publishService(working(), lima, T0), T1);
  expect(ended.work).toBeNull();
  expect(ended.workHistory[0].services).toHaveLength(1);
});

test("service errors carry codes and messages", () => {
  expect(new DuplicateService("http://x.test")).toMatchObject({ code: "DUPLICATE_SERVICE", message: '"http://x.test" is already published' });
  expect(new ServiceNotFound("s9")).toMatchObject({ code: "SERVICE_NOT_FOUND" });
});
