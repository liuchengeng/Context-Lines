import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSION,
  HealthResponseSchema,
  QuickAskAnswerSchema,
  QuickAskRequestSchema,
} from "../src/index";

describe("quick ask contracts", () => {
  it("publishes the current health contract", () => {
    expect(
      HealthResponseSchema.parse({ status: "ok", version: CONTRACT_VERSION }),
    ).toEqual({ status: "ok", version: "0.2.0" });
  });
  it("accepts a bounded wav clip and rejects excessive duration", () => {
    expect(
      QuickAskRequestSchema.safeParse({
        audio_base64: "a".repeat(32),
        mime_type: "audio/wav",
        duration_ms: 10_000,
      }).success,
    ).toBe(true);
    expect(
      QuickAskRequestSchema.safeParse({
        audio_base64: "a".repeat(32),
        mime_type: "audio/wav",
        duration_ms: 20_000,
      }).success,
    ).toBe(false);
  });
  it("requires every concise answer field", () => {
    expect(
      QuickAskAnswerSchema.safeParse({
        transcript: "Not a chance.",
        phrase: "not a chance",
        meaning_zh: "不可能。",
        context_zh: "强烈拒绝。",
        usage_zh: "口语。",
      }).success,
    ).toBe(true);
  });
});
