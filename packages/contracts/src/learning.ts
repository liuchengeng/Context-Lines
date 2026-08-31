import { z } from "zod";

import { ClassificationSchema } from "./analysis";

export const ReviewCardTypeSchema = z.enum([
  "personal_cloze",
  "scene_to_english",
  "english_to_meaning",
]);

export type ReviewCardType = z.infer<typeof ReviewCardTypeSchema>;

export const ReviewRatingSchema = z.enum(["again", "hard", "good", "easy"]);

export type ReviewRating = z.infer<typeof ReviewRatingSchema>;

export const SaveExpressionInputSchema = z
  .object({
    expression: z.string().trim().min(1).max(160),
    source_transcript: z.string().trim().min(1).max(1_200),
    meaning_zh: z.string().trim().min(1).max(600),
    intent: z.string().trim().min(1).max(600),
    usage_note: z.string().trim().min(1).max(600),
    personal_example: z.string().trim().min(1).max(600),
    meaning_classification: ClassificationSchema,
    schema_version: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.personal_example
        .toLocaleLowerCase("en-US")
        .includes(value.expression.toLocaleLowerCase("en-US"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["personal_example"],
        message: "personal example must contain the selected expression",
      });
    }
  });

export type SaveExpressionInput = z.infer<typeof SaveExpressionInputSchema>;

export const SavedExpressionSchema = SaveExpressionInputSchema.safeExtend({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();

export type SavedExpression = z.infer<typeof SavedExpressionSchema>;

export const ReviewCardSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    saved_expression_id: z.string().uuid(),
    card_type: ReviewCardTypeSchema,
    due_at: z.string().datetime({ offset: true }),
    stability: z.number().nonnegative(),
    difficulty: z.number().nonnegative(),
    elapsed_days: z.number().int().nonnegative(),
    scheduled_days: z.number().int().nonnegative(),
    learning_steps: z.number().int().nonnegative(),
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    state: z.number().int().min(0).max(3),
    last_review_at: z.string().datetime({ offset: true }).nullable(),
    version: z.number().int().nonnegative(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    expression: SavedExpressionSchema,
  })
  .strict();

export type ReviewCard = z.infer<typeof ReviewCardSchema>;

export const ReviewCardUpdateSchema = ReviewCardSchema.omit({
  expression: true,
  created_at: true,
  updated_at: true,
}).pick({
  due_at: true,
  stability: true,
  difficulty: true,
  elapsed_days: true,
  scheduled_days: true,
  learning_steps: true,
  reps: true,
  lapses: true,
  state: true,
  last_review_at: true,
});

export type ReviewCardUpdate = z.infer<typeof ReviewCardUpdateSchema>;
