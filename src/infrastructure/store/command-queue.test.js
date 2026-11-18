// @vitest-environment node
import { createCommandQueue } from "./command-queue.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("functions run strictly one after another and answer their own caller", async () => {
  const queue = createCommandQueue();
  const log = [];
  const job = (name, ms) => async () => {
    log.push(`start ${name}`);
    await wait(ms);
    log.push(`end ${name}`);
    return name;
  };
  const results = await Promise.all([queue.run(job("a", 30)), queue.run(job("b", 1)), queue.run(job("c", 10))]);
  expect(results).toEqual(["a", "b", "c"]);
  expect(log).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
});

test("a failing function rejects only its own promise", async () => {
  const queue = createCommandQueue();
  const failing = queue.run(async () => {
    throw new Error("boom");
  });
  const thrown = queue.run(() => {
    throw new Error("sync boom");
  });
  const next = queue.run(async () => "fine");
  await expect(failing).rejects.toThrow("boom");
  await expect(thrown).rejects.toThrow("sync boom");
  await expect(next).resolves.toBe("fine");
});
