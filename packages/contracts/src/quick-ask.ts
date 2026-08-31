import { z } from "zod";

export const QuickAskRequestSchema = z.object({
  audio_base64: z.string().min(16).max(1_800_000),
  mime_type: z.literal("audio/wav"),
  duration_ms: z.number().int().min(500).max(12_000),
  page_title: z.string().trim().max(160).optional(),
  page_origin: z.string().url().max(200).optional(),
});

export type QuickAskRequest = z.infer<typeof QuickAskRequestSchema>;

export const QuickAskExplanationSchema = z.object({
  phrase: z.string().trim().min(1).max(120),
  meaning_zh: z.string().trim().min(1).max(80),
});

export const QuickAskAnswerSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  explanations: z.array(QuickAskExplanationSchema).min(1).max(3),
});

export type QuickAskAnswer = z.infer<typeof QuickAskAnswerSchema>;
