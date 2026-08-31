import { z } from "zod";

export const QuickAskRequestSchema = z.object({
  audio_base64: z.string().min(16).max(1_800_000),
  mime_type: z.literal("audio/wav"),
  duration_ms: z.number().int().min(500).max(12_000),
  page_title: z.string().trim().max(160).optional(),
  page_origin: z.string().url().max(200).optional(),
});

export type QuickAskRequest = z.infer<typeof QuickAskRequestSchema>;

export const QuickAskAnswerSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  phrase: z.string().trim().min(1).max(160),
  meaning_zh: z.string().trim().min(1).max(240),
  context_zh: z.string().trim().min(1).max(320),
  usage_zh: z.string().trim().min(1).max(320),
});

export type QuickAskAnswer = z.infer<typeof QuickAskAnswerSchema>;

export const QuickAskViewStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("loading") }),
  z.object({ status: z.literal("answer"), answer: QuickAskAnswerSchema }),
  z.object({
    status: z.literal("error"),
    message: z.string().min(1).max(240),
  }),
]);

export type QuickAskViewState = z.infer<typeof QuickAskViewStateSchema>;
