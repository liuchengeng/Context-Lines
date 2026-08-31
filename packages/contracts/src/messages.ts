import { z } from "zod";

import { TranscriptLineSchema } from "./transcript";

export const OverlayUpdateMessageSchema = z.object({
  type: z.literal("overlay:update"),
  tab_id: z.number().int().positive(),
  lines: z.array(TranscriptLineSchema).max(4),
});

export const OverlayClearMessageSchema = z.object({
  type: z.literal("overlay:clear"),
  tab_id: z.number().int().positive(),
});

export const CaptureStartedMessageSchema = z.object({
  type: z.literal("capture:started"),
  tab_id: z.number().int().positive(),
  origin: z.string().max(256),
});

export const CaptureStopRequestedMessageSchema = z.object({
  type: z.literal("capture:stop-requested"),
  reason: z.enum([
    "active-tab-changed",
    "source-navigation",
    "source-tab-closed",
  ]),
});

export const CaptureStoppedMessageSchema = z.object({
  type: z.literal("capture:stopped"),
  tab_id: z.number().int().positive(),
});

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  OverlayUpdateMessageSchema,
  OverlayClearMessageSchema,
  CaptureStartedMessageSchema,
  CaptureStopRequestedMessageSchema,
  CaptureStoppedMessageSchema,
]);

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;
