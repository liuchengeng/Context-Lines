import { describe, expect, it } from "vitest";
import {
  QuickAskAnswerSchema,
  QuickAskRequestSchema,
  SaveVocabularyItemSchema,
  VocabularyItemSchema,
} from "../src/index";

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
  it("accepts zero to three concise phrase explanations", () => {
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
    ).toBe(true);
    expect(
      QuickAskAnswerSchema.safeParse({
        transcript: "There are several phrases here.",
        translation_zh: "这里有几个短语。",
        explanations: [
          { phrase: "one", meaning_zh: "一" },
          { phrase: "two", meaning_zh: "二" },
          { phrase: "three", meaning_zh: "三" },
          { phrase: "four", meaning_zh: "四" },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts bounded manually saved words and phrases", () => {
    expect(
      SaveVocabularyItemSchema.safeParse({
        term: "embarrassed",
        meaning_zh: "尴尬的",
        kind: "word",
      }).success,
    ).toBe(true);
    expect(
      VocabularyItemSchema.safeParse({
        id: "55e767a4-6450-4f6a-8248-855422e82ee6",
        term: "no end of",
        meaning_zh: "很多，没完没了",
        kind: "phrase",
        created_at: "2026-09-01T06:00:00.000Z",
        updated_at: "2026-09-01T06:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
