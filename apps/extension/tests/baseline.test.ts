import { describe, expect, it } from "vitest";

import { CONTRACT_VERSION } from "@contextlines/contracts";

describe("extension baseline", () => {
  it("loads the shared contract package", () => {
    expect(CONTRACT_VERSION).toBe("0.1.0");
  });
});
