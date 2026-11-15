import { describe, expect, it } from "vitest";
import { allowedDevOrigins } from "./dev-origins.js";

describe("allowedDevOrigins", () => {
  it("is empty when K_SPEC_HOST is unset or blank", () => {
    expect(allowedDevOrigins({})).toEqual([]);
    expect(allowedDevOrigins({ K_SPEC_HOST: "   " })).toEqual([]);
  });

  it("allow-lists the host the access link is printed with", () => {
    expect(allowedDevOrigins({ K_SPEC_HOST: "lima-dev-k-spec-main.local" })).toEqual(["lima-dev-k-spec-main.local"]);
  });

  it("trims whitespace and drops a port, since Next matches host names only", () => {
    expect(allowedDevOrigins({ K_SPEC_HOST: " my-host:3000 " })).toEqual(["my-host"]);
  });
});
