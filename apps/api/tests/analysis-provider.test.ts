import { describe, expect, it, vi } from "vitest";

import { OpenAIAnalysisProvider } from "../src/analysis-provider";

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

const context = {
  previous: [],
  current: {
    id: "line-1",
    sequence: 0,
    text: "That ship has sailed.",
  },
  page: { title: "Synthetic dialogue", origin: "https://example.com" },
};

const note = {
  text: "说明",
  classification: "language_fact",
  confidence: 0.9,
} as const;

const quick = {
  transcript: context.current.text,
  natural_zh: { ...note, text: "木已成舟。" },
  literal_zh: { ...note, text: "那艘船已经开走了。" },
  intent: {
    ...note,
    text: "指出机会已经过去",
    classification: "scene_inference" as const,
  },
  tone: { ...note, text: "直白但克制" },
  register: { ...note, text: "日常口语" },
  chunks: [
    {
      text: "that ship has sailed",
      meaning_zh: { ...note, text: "机会已经错过" },
      usage_note: { ...note, text: "用于不可逆的错过" },
    },
  ],
  confidence: 0.93,
  scene_inference: [],
  insufficient_context: false,
};

describe("OpenAIAnalysisProvider", () => {
  it("uses strict structured output without storing the response", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          model: string;
          store: boolean;
          text: { format: { type: string; strict: boolean; schema: unknown } };
          input: Array<{ content: Array<{ text: string }> }>;
        };
        expect(request).toMatchObject({
          model: "configured-quick-model",
          store: false,
          text: { format: { type: "json_schema", strict: true } },
        });
        expect(request.text.format.schema).toBeTruthy();
        expect(request.input[0]?.content[0]?.text).toContain(
          '"origin":"https://example.com"',
        );
        expect(request.input[0]?.content[0]?.text).not.toContain("page_body");
        return Response.json({
          status: "completed",
          output_text: JSON.stringify(quick),
        });
      },
    );

    const provider = new OpenAIAnalysisProvider(
      env,
      "user-id",
      "request-id",
      fetcher as typeof fetch,
    );

    await expect(provider.quick(context)).resolves.toEqual(quick);
  });

  it("rejects invalid model JSON instead of returning it to the client", async () => {
    const provider = new OpenAIAnalysisProvider(
      env,
      "user-id",
      "request-id",
      vi.fn(async () =>
        Response.json({ output_text: "not-json" }),
      ) as unknown as typeof fetch,
    );

    await expect(provider.quick(context)).rejects.toMatchObject({
      code: "INVALID_MODEL_RESPONSE",
      status: 502,
    });
  });
});
