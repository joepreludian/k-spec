/**
 * Runs functions one at a time, in the order they were queued. A use case loads the board,
 * computes, then saves; letting two overlap would make the second save erase the first.
 */
export function createCommandQueue() {
  let tail = Promise.resolve();
  return {
    run(fn) {
      const result = tail.then(() => fn());
      tail = result.catch(() => {});
      return result;
    },
  };
}
