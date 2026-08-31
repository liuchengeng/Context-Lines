import { describe, expect, it } from "vitest";

import app from "../src/index";

describe("GET /health", () => {
  it("returns only status and version", async () => {
    const response = await app.request("http://worker.test/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", version: "0.1.0" });
  });

  it("uses the unified error contract for protected routes", async () => {
    const response = await app.request(
      "http://worker.test/v1/realtime/client-secret",
      { method: "POST" },
      {
        ALLOWED_EMAIL: "learner@example.com",
        ALLOWED_EXTENSION_ID: "extension-id",
        OPENAI_API_KEY: "secret",
        OPENAI_TRANSCRIPTION_MODEL: "transcription-model",
        OPENAI_QUICK_ANALYSIS_MODEL: "quick-model",
        OPENAI_DEEP_ANALYSIS_MODEL: "deep-model",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "AUTH_REQUIRED",
      message: "请先登录。",
      retryable: false,
    });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });
});
