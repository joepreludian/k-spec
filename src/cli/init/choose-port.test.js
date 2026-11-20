// @vitest-environment node
import { choosePort, PORT_FIRST, PORT_LAST } from "./choose-port.js";

/** A repeatable source of bytes: the same seed gives the same bytes. */
function bytes(seed) {
  let state = seed;
  return (n) =>
    Uint8Array.from({ length: n }, () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return (state >> 16) & 0xff;
    });
}

/** `portIsFree` that remembers what it was asked; `taken` is a set of ports or a rule. */
function checker(taken = new Set()) {
  const asked = [];
  const isTaken = typeof taken === "function" ? taken : (port) => taken.has(port);
  return { asked, portIsFree: async (port) => (asked.push(port), !isTaken(port, asked.length)) };
}

test("the range is 14201 to 14299", () => {
  expect([PORT_FIRST, PORT_LAST]).toEqual([14201, 14299]);
});

test("with every port free, the first one asked about is the answer", async () => {
  const { asked, portIsFree } = checker();
  const port = await choosePort({ randomBytes: bytes(1), portIsFree });
  expect(port).toBeGreaterThanOrEqual(14201);
  expect(port).toBeLessThanOrEqual(14299);
  expect(asked).toEqual([port]);
});

test("the order comes from the random bytes", async () => {
  const first = new Set();
  for (let seed = 1; seed <= 20; seed += 1) first.add(await choosePort({ randomBytes: bytes(seed), portIsFree: async () => true }));
  expect(first.size).toBeGreaterThan(10);
  const again = await choosePort({ randomBytes: bytes(7), portIsFree: async () => true });
  expect(await choosePort({ randomBytes: bytes(7), portIsFree: async () => true })).toBe(again);
});

test("taken ports are skipped: the answer is the first free one in the order", async () => {
  const { asked, portIsFree } = checker((port, count) => count <= 3);
  const port = await choosePort({ randomBytes: bytes(3), portIsFree });
  expect(asked).toHaveLength(4);
  expect(port).toBe(asked[3]);
  expect(new Set(asked).size).toBe(4);
});

test("no free port: null, after asking about each of the 99 once", async () => {
  const { asked, portIsFree } = checker(() => true);
  expect(await choosePort({ randomBytes: bytes(5), portIsFree })).toBeNull();
  expect(asked).toHaveLength(99);
  expect([...asked].sort((a, b) => a - b)).toEqual(Array.from({ length: 99 }, (_, i) => 14201 + i));
});
