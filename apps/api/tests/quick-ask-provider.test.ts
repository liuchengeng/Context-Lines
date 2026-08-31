import { afterEach, describe, expect, it, vi } from "vitest";
import { answerQuickAsk } from "../src/quick-ask-provider";

const env: Env = {
  ALLOWED_EXTENSION_ID: "extension-id",
  QUICK_ASK_ACCESS_TOKEN: "token",
  DOUBAO_ASR_URL: "https://openspeech.test/api/v3/auc/bigmodel/recognize/flash",
  DOUBAO_ASR_RESOURCE_ID: "volc.bigasr.auc_turbo",
  DOUBAO_ASR_MODEL: "bigmodel",
  DOUBAO_API_KEY: "doubao-key",
  DEEPSEEK_BASE_URL: "https://deepseek.test",
  DEEPSEEK_MODEL: "deepseek-fast",
  DEEPSEEK_API_KEY: "deepseek-key",
};

afterEach(() => vi.unstubAllGlobals());

describe("answerQuickAsk", () => {
  it("transcribes before producing a schema-checked explanation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { text: "I wouldn't read too much into it." },
          }),
          {
            status: 200,
            headers: { "X-Api-Status-Code": "20000000" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    transcript: "I wouldn't read too much into it.",
                    phrase: "read too much into it",
                    meaning_zh: "别过度解读。",
                    context_zh: "让对方别想太多。",
                    usage_zh: "用于提醒人不要从细节做过多推断。",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await answerQuickAsk(env, {
      audio_base64: "a".repeat(32),
      mime_type: "audio/wav",
      duration_ms: 8_000,
    });
    expect(answer.phrase).toBe("read too much into it");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://openspeech.test/api/v3/auc/bigmodel/recognize/flash",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://deepseek.test/chat/completions",
    );
    const asrRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(asrRequest.headers).toMatchObject({
      "X-Api-Key": "doubao-key",
      "X-Api-Resource-Id": "volc.bigasr.auc_turbo",
      "X-Api-Sequence": "-1",
    });
    expect(JSON.parse(String(asrRequest.body))).toMatchObject({
      audio: { data: "a".repeat(32) },
      request: { model_name: "bigmodel" },
    });
  });

  it("maps Doubao silence responses without calling DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000003" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      answerQuickAsk(env, {
        audio_base64: "a".repeat(32),
        mime_type: "audio/wav",
        duration_ms: 8_000,
      }),
    ).rejects.toMatchObject({ code: "NO_SPEECH", status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
