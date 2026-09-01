import { z } from "zod";

export const VocabularyKindSchema = z.enum(["word", "phrase"]);

export const SaveVocabularyItemSchema = z.object({
  term: z.string().trim().min(1).max(120),
  meaning_zh: z.string().trim().min(1).max(80),
  kind: VocabularyKindSchema,
});

export const VocabularyItemSchema = SaveVocabularyItemSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const VocabularyListSchema = z.object({
  items: z.array(VocabularyItemSchema).max(500),
});

export type SaveVocabularyItem = z.infer<typeof SaveVocabularyItemSchema>;
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;
export type VocabularyKind = z.infer<typeof VocabularyKindSchema>;
