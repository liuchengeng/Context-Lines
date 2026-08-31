import { describe, expect, it } from "vitest";

import { QuickAnalysisSchema, TranscriptContextSchema } from "../src/index";

const note = {
  text: "示例说明",
  classification: "language_fact" as const,
  confidence: 0.9,
};

describe("analysis contracts", () => {
  it("accepts a bounded quick analysis", () => {
    const result = QuickAnalysisSchema.parse({
      transcript: "That ship has sailed.",
      natural_zh: note,
      literal_zh: note,
      intent: { ...note, classification: "scene_inference" },
      tone: note,
      register: note,
      chunks: [
        {
          text: "that ship has sailed",
          meaning_zh: note,
          usage_note: note,
        },
      ],
      confidence: 0.92,
      scene_inference: [
        {
          text: "某个机会已经错过",
          classification: "scene_inference",
          confidence: 0.7,
        },
      ],
      insufficient_context: false,
    });

    expect(result.chunks[0]?.text).toBe("that ship has sailed");
  });

  it("rejects extra browsing data in transcript context", () => {
    const result = TranscriptContextSchema.safeParse({
      previous: [],
      current: { id: "line", sequence: 0, text: "Hello" },
      page: { title: "Example", origin: "https://example.com" },
      page_body: "private page content",
    });

    expect(result.success).toBe(false);
  });

  it("requires scene inferences to be classified as inference", () => {
    const result = QuickAnalysisSchema.safeParse({
      transcript: "Fine.",
      natural_zh: note,
      literal_zh: note,
      intent: note,
      tone: note,
      register: note,
      chunks: [],
      confidence: 0.4,
      scene_inference: [{ ...note, classification: "external_fact" }],
      insufficient_context: true,
    });

    expect(result.success).toBe(false);
  });
});
