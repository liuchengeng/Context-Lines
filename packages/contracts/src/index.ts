import { z } from "zod";

export const CONTRACT_VERSION = "0.1.0" as const;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().min(1).max(32),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
