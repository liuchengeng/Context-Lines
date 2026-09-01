import { z } from "zod";

export const QuickAskRequestSchema = z.object({
  audio_base64: z.string().min(16).max(1_800_000),
  mime_type: z.literal("audio/wav"),
  duration_ms: z.number().int().min(500).max(12_000),
});

export type QuickAskRequest = z.infer<typeof QuickAskRequestSchema>;

export const QuickAskExplanationSchema = z.object({
  phrase: z.string().trim().min(1).max(120),
  meaning_zh: z.string().trim().min(1).max(80),
});

export const QuickAskAnswerSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  translation_zh: z.string().trim().min(1).max(500),
  explanations: z.array(QuickAskExplanationSchema).max(3),
});

export type QuickAskAnswer = z.infer<typeof QuickAskAnswerSchema>;
