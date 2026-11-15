import { describe, expect, it } from "vitest";
import { createIdGenerator, randomIdGenerator } from "./id-generator.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("id generator", () => {
  it("uses crypto.randomUUID when the browser offers it", () => {
    const ids = createIdGenerator({ randomUUID: () => "fixed-id", getRandomValues: () => {} });
    expect(ids.next()).toBe("fixed-id");
  });

  it("falls back to getRandomValues when randomUUID is missing (plain-http pages are not secure contexts)", () => {
    const ids = createIdGenerator({
      getRandomValues: (bytes) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = 0xff;
        return bytes;
      },
    });
    expect(ids.next()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("produces distinct v4 uuids with the real crypto object", () => {
    const a = randomIdGenerator.next();
    const b = randomIdGenerator.next();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
