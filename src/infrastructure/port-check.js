import net from "node:net";

// Every address of the machine, IPv6 first. Both are needed: something listening on the IPv6
// loopback only is seen by the first attempt alone, and a machine without IPv6 only has the second.
const EVERY_ADDRESS = ["::", "0.0.0.0"];

/** Whether listening on `port` at `host` is possible, or at least not refused as "in use". */
function canListen(port, host, createServer) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error) => resolve(error.code !== "EADDRINUSE"));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

/**
 * Whether nothing on this machine is listening on `port`: it tries to listen there itself and
 * lets go at once. False only when an attempt is refused with "address in use"; any other
 * refusal (no such address family, no permission for a low port) means "cannot tell" and does
 * not make the port taken. It sees the ports of the network it runs in: inside a container
 * that is the machine's only with the host's network.
 */
export async function portIsFree(port, { createServer = () => net.createServer() } = {}) {
  for (const host of EVERY_ADDRESS) {
    if (!(await canListen(port, host, createServer))) return false;
  }
  return true;
}
