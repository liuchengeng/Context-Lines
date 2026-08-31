import { z } from "zod";

export const TRANSCRIPT_TEXT_MAX_LENGTH = 1_200;
export const PAGE_TITLE_MAX_LENGTH = 160;
export const PAGE_ORIGIN_MAX_LENGTH = 256;

export const TranscriptStatusSchema = z.enum(["partial", "final"]);

export const TranscriptLineSchema = z.object({
  id: z.string().min(1).max(128),
  sequence: z.number().int().nonnegative(),
  text: z.string().min(1).max(TRANSCRIPT_TEXT_MAX_LENGTH),
  status: TranscriptStatusSchema,
  started_at_ms: z.number().int().nonnegative(),
  ended_at_ms: z.number().int().nonnegative().optional(),
});

export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const TranscriptExcerptSchema = TranscriptLineSchema.pick({
  id: true,
  sequence: true,
  text: true,
});

export type TranscriptExcerpt = z.infer<typeof TranscriptExcerptSchema>;

export const PageContextSchema = z.object({
  title: z.string().trim().min(1).max(PAGE_TITLE_MAX_LENGTH),
  origin: z
    .string()
    .trim()
    .min(1)
    .max(PAGE_ORIGIN_MAX_LENGTH)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          url.origin === value
        );
      } catch {
        return false;
      }
    }, "origin must be an HTTP(S) origin without a path"),
});

export const TranscriptContextSchema = z.object({
  previous: z.array(TranscriptExcerptSchema).max(3),
  current: TranscriptExcerptSchema,
  next: TranscriptExcerptSchema.optional(),
  page: PageContextSchema,
});

export type TranscriptContext = z.infer<typeof TranscriptContextSchema>;
