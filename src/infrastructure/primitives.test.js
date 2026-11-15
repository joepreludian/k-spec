import { systemClock, fixedClock } from "./clock.js";
import { randomIdGenerator, sequentialIdGenerator } from "./id-generator.js";

test("systemClock returns an ISO string", () => {
  const now = systemClock.now();
  expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Math.abs(Date.now() - new Date(now).getTime())).toBeLessThan(5000);
});

test("fixedClock always returns the given time", () => {
  const c = fixedClock("2026-11-14T10:00:00.000Z");
  expect(c.now()).toBe("2026-11-14T10:00:00.000Z");
  expect(c.now()).toBe("2026-11-14T10:00:00.000Z");
});

test("randomIdGenerator yields unique uuids", () => {
  const a = randomIdGenerator.next();
  expect(a).toMatch(/^[0-9a-f-]{36}$/);
  expect(randomIdGenerator.next()).not.toBe(a);
});

test("sequentialIdGenerator counts from 1 with prefix", () => {
  const g = sequentialIdGenerator();
  expect([g.next(), g.next()]).toEqual(["id-1", "id-2"]);
  expect(sequentialIdGenerator("card").next()).toBe("card-1");
});
