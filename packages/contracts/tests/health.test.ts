import { describe, expect, it } from "vitest";

import { CONTRACT_VERSION, HealthResponseSchema } from "../src/index";

describe("HealthResponseSchema", () => {
  it("accepts the public health shape", () => {
    expect(
      HealthResponseSchema.parse({ status: "ok", version: CONTRACT_VERSION }),
    ).toEqual({ status: "ok", version: "0.1.0" });
  });
});
