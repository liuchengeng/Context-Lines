import { z } from "zod";

export const WorkerErrorSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(240),
  request_id: z.string().min(1).max(64),
  retryable: z.boolean(),
});

export type WorkerError = z.infer<typeof WorkerErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().min(1).max(32),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
