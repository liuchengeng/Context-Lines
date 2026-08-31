import {
  ReviewCardSchema,
  SavedExpressionSchema,
  type ReviewCard,
  type ReviewRating,
  type SaveExpressionInput,
  type SavedExpression,
} from "@contextlines/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ReviewTransition } from "./review-scheduler";
import { getSupabaseClient } from "./supabase";

export interface LearningRepository {
  saveExpression(input: SaveExpressionInput): Promise<SavedExpression>;
  listDueCards(now: Date): Promise<ReviewCard[]>;
  recordReview(
    card: ReviewCard,
    rating: ReviewRating,
    transition: ReviewTransition,
  ): Promise<void>;
}

export class SupabaseLearningRepository implements LearningRepository {
  constructor(private readonly configuredClient?: SupabaseClient) {}

  #client(): SupabaseClient {
    return this.configuredClient ?? getSupabaseClient();
  }

  async saveExpression(input: SaveExpressionInput): Promise<SavedExpression> {
    const response = await this.#client()
      .from("saved_expressions")
      .insert(input)
      .select("*")
      .single();
    if (response.error) throw new Error(response.error.message);
    return SavedExpressionSchema.parse(response.data);
  }

  async listDueCards(now: Date): Promise<ReviewCard[]> {
    const response = await this.#client()
      .from("review_cards")
      .select("*, expression:saved_expressions(*)")
      .lte("due_at", now.toISOString())
      .order("due_at", { ascending: true })
      .limit(100);
    if (response.error) throw new Error(response.error.message);
    return z.array(ReviewCardSchema).parse(response.data);
  }

  async recordReview(
    card: ReviewCard,
    _rating: ReviewRating,
    transition: ReviewTransition,
  ): Promise<void> {
    const update = transition.update;
    const response = await this.#client().rpc("record_review", {
      p_card_id: card.id,
      p_expected_version: card.version,
      p_rating: transition.numericRating,
      p_due_at: update.due_at,
      p_stability: update.stability,
      p_difficulty: update.difficulty,
      p_elapsed_days: update.elapsed_days,
      p_scheduled_days: update.scheduled_days,
      p_learning_steps: update.learning_steps,
      p_reps: update.reps,
      p_lapses: update.lapses,
      p_state: update.state,
      p_last_review_at: update.last_review_at,
      p_before_state: transition.before,
      p_after_state: transition.after,
    });
    if (response.error) {
      throw new Error(
        response.error.code === "40001"
          ? "这张卡已在其他会话复习，请刷新后继续。"
          : response.error.message,
      );
    }
  }
}

const mockUserId = "00000000-0000-4000-8000-000000000001";
const mockExpressions: SavedExpression[] = [];
const mockCards: ReviewCard[] = [];

export class MockLearningRepository implements LearningRepository {
  async saveExpression(input: SaveExpressionInput): Promise<SavedExpression> {
    const now = new Date().toISOString();
    const expression = SavedExpressionSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      user_id: mockUserId,
      created_at: now,
      updated_at: now,
    });
    mockExpressions.push(expression);
    for (const cardType of [
      "personal_cloze",
      "scene_to_english",
      "english_to_meaning",
    ] as const) {
      mockCards.push(
        ReviewCardSchema.parse({
          id: crypto.randomUUID(),
          user_id: mockUserId,
          saved_expression_id: expression.id,
          card_type: cardType,
          due_at: now,
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
          created_at: now,
          updated_at: now,
          expression,
        }),
      );
    }
    return expression;
  }

  async listDueCards(now: Date): Promise<ReviewCard[]> {
    return mockCards
      .filter((card) => new Date(card.due_at) <= now)
      .sort((left, right) => left.due_at.localeCompare(right.due_at));
  }

  async recordReview(
    card: ReviewCard,
    _rating: ReviewRating,
    transition: ReviewTransition,
  ): Promise<void> {
    const index = mockCards.findIndex((candidate) => candidate.id === card.id);
    if (index < 0) throw new Error("复习卡不存在。");
    const current = mockCards[index]!;
    if (current.version !== card.version) {
      throw new Error("这张卡已在其他会话复习，请刷新后继续。");
    }
    mockCards[index] = ReviewCardSchema.parse({
      ...current,
      ...transition.update,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    });
  }
}

export function createLearningRepository(
  useMocks: boolean,
): LearningRepository {
  return useMocks
    ? new MockLearningRepository()
    : new SupabaseLearningRepository();
}
