import { ReviewCardSchema, type ReviewCard } from "@contextlines/contracts";
import { describe, expect, it } from "vitest";

import { scheduleReview } from "../src/lib/review-scheduler";

function newCard(): ReviewCard {
  const created = "2026-08-31T12:00:00.000Z";
  return ReviewCardSchema.parse({
    id: "10000000-0000-4000-8000-000000000001",
    user_id: "00000000-0000-4000-8000-000000000001",
    saved_expression_id: "20000000-0000-4000-8000-000000000001",
    card_type: "personal_cloze",
    due_at: created,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review_at: null,
    version: 0,
    created_at: created,
    updated_at: created,
    expression: {
      id: "20000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-4000-8000-000000000001",
      expression: "keep the peace",
      source_transcript: "She was just trying to keep the peace.",
      meaning_zh: "维持和气",
      intent: "避免冲突",
      usage_note: "用于人际冲突场景。",
      personal_example: "I try to keep the peace at work.",
      meaning_classification: "language_fact",
      schema_version: 1,
      created_at: created,
      updated_at: created,
    },
  });
}

describe("scheduleReview", () => {
  it("maps a self-rating into an inspectable FSRS transition", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const transition = scheduleReview(newCard(), "good", now);

    expect(transition.numericRating).toBe(3);
    expect(transition.update.reps).toBe(1);
    expect(transition.update.last_review_at).toBe(now.toISOString());
    expect(new Date(transition.update.due_at).getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(transition.before.state).toBe(0);
    expect(transition.after.state).not.toBe(0);
  });
});
