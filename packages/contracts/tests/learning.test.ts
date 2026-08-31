import { describe, expect, it } from "vitest";

import { SaveExpressionInputSchema } from "../src";

const input = {
  expression: "read too much into it",
  source_transcript: "I wouldn't read too much into it.",
  meaning_zh: "过度解读某件事",
  intent: "劝对方不要作过多推断",
  usage_note: "常用于给讨论降温。",
  personal_example: "I read too much into it after our first meeting.",
  meaning_classification: "language_fact" as const,
  schema_version: 1,
};

describe("SaveExpressionInputSchema", () => {
  it("requires a personal example containing the selected expression", () => {
    expect(SaveExpressionInputSchema.parse(input)).toEqual(input);
    expect(
      SaveExpressionInputSchema.safeParse({
        ...input,
        personal_example: "I misunderstood the message.",
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected transcript or browsing fields", () => {
    expect(
      SaveExpressionInputSchema.safeParse({
        ...input,
        full_transcript: ["private line"],
      }).success,
    ).toBe(false);
  });
});
