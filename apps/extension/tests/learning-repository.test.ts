import {
  SaveExpressionInputSchema,
  type SaveExpressionInput,
} from "@contextlines/contracts";
import { describe, expect, it } from "vitest";

import { MockLearningRepository } from "../src/lib/learning-repository";
import { scheduleReview } from "../src/lib/review-scheduler";

const input: SaveExpressionInput = SaveExpressionInputSchema.parse({
  expression: "keep the peace",
  source_transcript: "She was just trying to keep the peace.",
  meaning_zh: "维持和气",
  intent: "避免冲突",
  usage_note: "用于人际冲突场景。",
  personal_example: "I try to keep the peace at work.",
  meaning_classification: "language_fact",
  schema_version: 1,
});

describe("MockLearningRepository", () => {
  it("creates three due cards and applies an FSRS review", async () => {
    const repository = new MockLearningRepository();
    const expression = await repository.saveExpression(input);
    const due = (await repository.listDueCards(new Date())).filter(
      (card) => card.saved_expression_id === expression.id,
    );

    expect(due.map((card) => card.card_type).sort()).toEqual([
      "english_to_meaning",
      "personal_cloze",
      "scene_to_english",
    ]);

    const card = due[0]!;
    const transition = scheduleReview(card, "good", new Date());
    await repository.recordReview(card, "good", transition);
    const remaining = (await repository.listDueCards(new Date())).filter(
      (candidate) => candidate.saved_expression_id === expression.id,
    );
    expect(remaining).toHaveLength(2);
  });
});
