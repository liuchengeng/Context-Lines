import { z } from "zod";

import { TranscriptContextSchema } from "./transcript";

export const ClassificationSchema = z.enum([
  "language_fact",
  "scene_inference",
  "external_fact",
]);

export type Classification = z.infer<typeof ClassificationSchema>;

export const ClassifiedTextSchema = z
  .object({
    text: z.string().trim().min(1).max(600),
    classification: ClassificationSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type ClassifiedText = z.infer<typeof ClassifiedTextSchema>;

export const SceneInferenceSchema = ClassifiedTextSchema.extend({
  classification: z.literal("scene_inference"),
});

export const ExpressionChunkSchema = z
  .object({
    text: z.string().trim().min(1).max(160),
    meaning_zh: ClassifiedTextSchema,
    usage_note: ClassifiedTextSchema,
  })
  .strict();

export type ExpressionChunk = z.infer<typeof ExpressionChunkSchema>;

export const QuickAnalysisSchema = z
  .object({
    transcript: z.string().trim().min(1).max(1_200),
    natural_zh: ClassifiedTextSchema,
    literal_zh: ClassifiedTextSchema,
    intent: ClassifiedTextSchema,
    tone: ClassifiedTextSchema,
    register: ClassifiedTextSchema,
    chunks: z.array(ExpressionChunkSchema).max(6),
    confidence: z.number().min(0).max(1),
    scene_inference: z.array(SceneInferenceSchema).max(3),
    insufficient_context: z.boolean(),
  })
  .strict();

export type QuickAnalysis = z.infer<typeof QuickAnalysisSchema>;

export const ExampleVariantSchema = z
  .object({
    english: z.string().trim().min(1).max(240),
    natural_zh: z.string().trim().min(1).max(300),
    context: ClassifiedTextSchema,
  })
  .strict();

export const DeepAnalysisSchema = z
  .object({
    transcript: z.string().trim().min(1).max(1_200),
    implied_meaning: ClassifiedTextSchema,
    pragmatic_function: ClassifiedTextSchema,
    usage_notes: z.array(ClassifiedTextSchema).max(6),
    example_variants: z.array(ExampleVariantSchema).max(5),
    inappropriate_contexts: z.array(ClassifiedTextSchema).max(5),
    cultural_context: z.array(ClassifiedTextSchema).max(4),
    confidence: z.number().min(0).max(1),
    insufficient_context: z.boolean(),
  })
  .strict();

export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>;

export const QuickAnalysisRequestSchema = z
  .object({
    context: TranscriptContextSchema,
  })
  .strict();

export const DeepAnalysisRequestSchema = z
  .object({
    context: TranscriptContextSchema,
    quick: QuickAnalysisSchema,
  })
  .strict();

export interface AnalysisProvider {
  quick(
    context: z.infer<typeof TranscriptContextSchema>,
  ): Promise<QuickAnalysis>;
  deep(
    context: z.infer<typeof TranscriptContextSchema>,
    quick: QuickAnalysis,
  ): Promise<DeepAnalysis>;
}
