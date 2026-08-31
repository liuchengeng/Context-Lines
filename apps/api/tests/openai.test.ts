import { describe, expect, it, vi } from "vitest";

import { createRealtimeClientSecret } from "../src/openai";

const env: Env = {
  ALLOWED_EMAIL: "learner@example.com",
  ALLOWED_EXTENSION_ID: "extension-id",
  OPENAI_API_KEY: "worker-only-secret",
  OPENAI_TRANSCRIPTION_MODEL: "configured-transcription-model",
  OPENAI_QUICK_ANALYSIS_MODEL: "configured-quick-model",
  OPENAI_DEEP_ANALYSIS_MODEL: "configured-deep-model",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
};

describe("createRealtimeClientSecret", () => {
  it("creates an English transcription session with server VAD", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          session: {
            type: string;
            audio: {
              input: {
                transcription: { model: string; languages: string[] };
                turn_detection: { type: string };
              };
            };
          };
        };
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer worker-only-secret",
        });
        expect(body.session).toMatchObject({
          type: "transcription",
          audio: {
            input: {
              transcription: {
                model: "configured-transcription-model",
                languages: ["en"],
              },
              turn_detection: { type: "server_vad" },
            },
          },
        });
        return Response.json({
          value: `ek_${"a".repeat(40)}`,
          expires_at: 2_000_000_000,
        });
      },
    );

    await expect(
      createRealtimeClientSecret(
        env,
        "user-id",
        "request-id",
        fetcher as typeof fetch,
      ),
    ).resolves.toEqual({
      value: `ek_${"a".repeat(40)}`,
      expires_at: 2_000_000_000,
      model: "configured-transcription-model",
    });
  });
});
