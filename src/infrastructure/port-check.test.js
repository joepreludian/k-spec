// @vitest-environment node
import net from "node:net";
import { portIsFree } from "./port-check.js";

/** Listens on a port the system picks at `host`; resolves `{ port, close }`, or null when `host` cannot be listened on here. */
function hold(host, port = 0) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(null));
    server.listen({ port, host }, () => {
      resolve({ port: server.address().port, close: () => new Promise((done) => server.close(done)) });
    });
  });
}

const ipv6 = (await hold("::1").then(async (held) => (await held?.close(), held !== null)));

test("a port someone listens on at 127.0.0.1 is taken, and free again once they stop", async () => {
  const held = await hold("127.0.0.1");
  expect(await portIsFree(held.port)).toBe(false);
  await held.close();
  expect(await portIsFree(held.port)).toBe(true);
});

test("a port held on every IPv4 address is taken", async () => {
  const held = await hold("0.0.0.0");
  expect(await portIsFree(held.port)).toBe(false);
  await held.close();
});

test.skipIf(!ipv6)("a port held on the IPv6 loopback only is taken too", async () => {
  const held = await hold("::1");
  expect(await portIsFree(held.port)).toBe(false);
  await held.close();
});

test("checking keeps nothing: the port can be used right after", async () => {
  const probe = await hold("127.0.0.1");
  await probe.close();
  expect(await portIsFree(probe.port)).toBe(true);
  const again = await hold("0.0.0.0", probe.port);
  expect(again).not.toBeNull();
  await again.close();
});

test("only 'address in use' makes a port taken: a failure of another kind does not", async () => {
  const refuse = (code) => () => {
    const server = new net.Server();
    server.listen = () => {
      queueMicrotask(() => server.emit("error", Object.assign(new Error(code), { code })));
      return server;
    };
    return server;
  };
  expect(await portIsFree(80, { createServer: refuse("EACCES") })).toBe(true);
  expect(await portIsFree(80, { createServer: refuse("EAFNOSUPPORT") })).toBe(true);
  expect(await portIsFree(80, { createServer: refuse("EADDRINUSE") })).toBe(false);
});
