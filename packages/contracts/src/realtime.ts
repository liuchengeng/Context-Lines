import { z } from "zod";

export const RealtimeClientSecretResponseSchema = z.object({
  value: z.string().min(20).max(512),
  expires_at: z.number().int().positive(),
  model: z.string().min(1).max(128),
});

export type RealtimeClientSecretResponse = z.infer<
  typeof RealtimeClientSecretResponseSchema
>;

const RealtimeEventBaseSchema = z.object({
  event_id: z.string().min(1).max(128).optional(),
});

export const RealtimeInputCommittedEventSchema = RealtimeEventBaseSchema.extend(
  {
    type: z.literal("input_audio_buffer.committed"),
    item_id: z.string().min(1).max(128),
    previous_item_id: z.string().min(1).max(128).nullable().optional(),
  },
);

export const RealtimeTranscriptDeltaEventSchema =
  RealtimeEventBaseSchema.extend({
    type: z.literal("conversation.item.input_audio_transcription.delta"),
    item_id: z.string().min(1).max(128),
    content_index: z.number().int().nonnegative(),
    delta: z.string().max(1_200),
  });

export const RealtimeTranscriptCompletedEventSchema =
  RealtimeEventBaseSchema.extend({
    type: z.literal("conversation.item.input_audio_transcription.completed"),
    item_id: z.string().min(1).max(128),
    content_index: z.number().int().nonnegative(),
    transcript: z.string().max(1_200),
  });

export const RealtimeServerErrorEventSchema = RealtimeEventBaseSchema.extend({
  type: z.literal("error"),
  error: z.object({
    type: z.string().max(128).optional(),
    code: z.string().max(128).optional(),
    message: z.string().min(1).max(1_000),
  }),
});

export const SupportedRealtimeEventSchema = z.discriminatedUnion("type", [
  RealtimeInputCommittedEventSchema,
  RealtimeTranscriptDeltaEventSchema,
  RealtimeTranscriptCompletedEventSchema,
  RealtimeServerErrorEventSchema,
]);

export type SupportedRealtimeEvent = z.infer<
  typeof SupportedRealtimeEventSchema
>;
