/**
 * UUID v4 ids. `crypto.randomUUID` only exists in secure contexts (https or localhost);
 * a board opened over plain http from another host only has `getRandomValues`, so fall
 * back to building the uuid from random bytes.
 */
export function createIdGenerator(cryptoLike) {
  return {
    next: () => {
      if (typeof cryptoLike.randomUUID === "function") return cryptoLike.randomUUID();
      const bytes = cryptoLike.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
  };
}

export const randomIdGenerator = createIdGenerator(globalThis.crypto);

export function sequentialIdGenerator(prefix = "id") {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}
