import { RealtimeClientSecretResponseSchema } from "@contextlines/contracts";
import { z } from "zod";

import { HttpError } from "./http";

const OpenAIClientSecretSchema = z.object({
  value: z.string().min(20).max(512),
  expires_at: z.number().int().positive(),
});

async function safetyIdentifier(userId: string): Promise<string> {
  const encoded = new TextEncoder().encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createRealtimeClientSecret(
  env: Env,
  userId: string,
  requestId: string,
  fetcher: typeof fetch = fetch,
) {
  const model = env.OPENAI_TRANSCRIPTION_MODEL?.trim();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!model || !apiKey) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "实时识别服务尚未配置。",
      false,
    );
  }

  let response: Response;
  try {
    response = await fetcher(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": await safetyIdentifier(userId),
        },
        body: JSON.stringify({
          session: {
            type: "transcription",
            audio: {
              input: {
                transcription: {
                  model,
                  languages: ["en"],
                  delay: "low",
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              },
            },
          },
        }),
      },
    );
  } catch {
    throw new HttpError(
      503,
      "UPSTREAM_UNAVAILABLE",
      "实时识别服务暂时不可用。",
      true,
    );
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: "openai_client_secret_failed",
        request_id: requestId,
        upstream_status: response.status,
      }),
    );
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
      response.status === 429
        ? "请求过于频繁，请稍后重试。"
        : "实时识别服务未能创建会话。",
      response.status === 429 || response.status >= 500,
    );
  }

  const upstream: unknown = await response.json().catch(() => null);
  const parsed = OpenAIClientSecretSchema.safeParse(upstream);
  if (!parsed.success) {
    throw new HttpError(
      502,
      "INVALID_UPSTREAM_RESPONSE",
      "实时识别服务返回了无效响应。",
      true,
    );
  }

  return RealtimeClientSecretResponseSchema.parse({
    ...parsed.data,
    model,
  });
}
