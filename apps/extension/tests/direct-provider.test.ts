import { afterEach, describe, expect, it, vi } from "vitest";
import { answerWithProviders } from "../src/lib/direct-provider";

afterEach(() => vi.unstubAllGlobals());

describe("direct provider", () => {
  it("sends the clip to Doubao and the transcript to DeepSeek", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { text: "Not a chance." } }), {
          status: 200,
          headers: { "X-Api-Status-Code": "20000000" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    transcript: "Not a chance.",
                    phrase: "not a chance",
                    meaning_zh: "绝对不可能。",
                    context_zh: "这里是在明确拒绝。",
                    usage_zh: "口语中用于强烈否定。",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await answerWithProviders(
      "audio-data",
      { doubaoApiKey: "doubao-key", deepseekApiKey: "deepseek-key" },
      "Video",
    );
    expect(answer.phrase).toBe("not a chance");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("openspeech.bytedance.com");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("api.deepseek.com");
  });
});
