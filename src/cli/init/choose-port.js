/** The ports a board gets by default: one of these, picked at random when the project is set up. */
export const PORT_FIRST = 14201;
export const PORT_LAST = 14299;

/**
 * A free port for a new board: every port of the range in an order drawn from `randomBytes(n)`
 * (a Uint8Array of n bytes), the first one `portIsFree(port)` says yes to. Null when none is free.
 */
export async function choosePort({ randomBytes, portIsFree }) {
  const ports = Array.from({ length: PORT_LAST - PORT_FIRST + 1 }, (_, index) => PORT_FIRST + index);
  const random = randomBytes(ports.length * 2);
  for (let i = ports.length - 1; i > 0; i -= 1) {
    const j = ((random[i * 2] << 8) | random[i * 2 + 1]) % (i + 1);
    [ports[i], ports[j]] = [ports[j], ports[i]];
  }
  for (const port of ports) {
    if (await portIsFree(port)) return port;
  }
  return null;
}
