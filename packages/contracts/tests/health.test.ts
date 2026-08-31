import { describe, expect, it } from "vitest";
import { QuickAskAnswerSchema, QuickAskRequestSchema } from "../src/index";

describe("quick ask contracts", () => {
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
  it("accepts one to three concise phrase explanations", () => {
    expect(
      QuickAskAnswerSchema.safeParse({
        transcript: "Not a chance.",
        translation_zh: "想都别想。",
        explanations: [
          { phrase: "Not a chance", meaning_zh: "想都别想" },
          { phrase: "a chance", meaning_zh: "机会" },
        ],
      }).success,
    ).toBe(true);
    expect(
      QuickAskAnswerSchema.safeParse({
        transcript: "Not a chance.",
        translation_zh: "想都别想。",
        explanations: [],
      }).success,
    ).toBe(false);
  });
});
