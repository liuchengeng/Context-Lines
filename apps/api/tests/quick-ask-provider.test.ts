import { afterEach, describe, expect, it, vi } from "vitest";
import { answerQuickAsk } from "../src/quick-ask-provider";

const env: Env = {
  ALLOWED_EXTENSION_ID: "extension-id",
  QUICK_ASK_ACCESS_TOKEN: "token",
  QWEN_ASR_BASE_URL: "https://qwen.test/v1",
  QWEN_ASR_MODEL: "qwen-asr",
  DASHSCOPE_API_KEY: "qwen-key",
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
            choices: [
              { message: { content: "I wouldn't read too much into it." } },
            ],
          }),
          { status: 200 },
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
      "https://qwen.test/v1/chat/completions",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://deepseek.test/chat/completions",
    );
  });
});
