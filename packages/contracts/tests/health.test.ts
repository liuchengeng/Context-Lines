import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  HealthResponseSchema,
  TranscriptContextSchema,
} from "../src/index";

describe("HealthResponseSchema", () => {
  it("accepts the public health shape", () => {
    expect(
      HealthResponseSchema.parse({ status: "ok", version: CONTRACT_VERSION }),
    ).toEqual({ status: "ok", version: "0.1.0" });
  });
});

describe("TranscriptContextSchema", () => {
  it("rejects a full URL where only origin is allowed", () => {
    const result = TranscriptContextSchema.safeParse({
      previous: [],
      current: { id: "line-1", sequence: 0, text: "Hello" },
      page: {
        title: "Example",
        origin: "https://example.com/private/watch?id=42",
      },
    });

    expect(result.success).toBe(false);
  });
});
