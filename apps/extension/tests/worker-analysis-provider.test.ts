import { describe, expect, it, vi } from "vitest";

import { WorkerAnalysisProvider } from "../src/lib/analysis-provider";

const context = {
  previous: [],
  current: { id: "line-1", sequence: 0, text: "That ship has sailed." },
  page: { title: "Synthetic", origin: "https://example.test" },
};

describe("WorkerAnalysisProvider", () => {
  it("does not render malformed model output returned by the Worker", async () => {
    const provider = new WorkerAnalysisProvider({
      baseUrl: "https://api.example.test",
      getAccessToken: async () => "access-token",
      fetcher: vi.fn(async () =>
        Response.json({ transcript: "missing required fields" }),
      ) as unknown as typeof fetch,
    });

    await expect(provider.quick(context)).rejects.toThrow(
      "分析服务返回了无效数据。",
    );
  });

  it("surfaces a sanitized retryable 429 error", async () => {
    const provider = new WorkerAnalysisProvider({
      baseUrl: "https://api.example.test",
      getAccessToken: async () => "access-token",
      fetcher: vi.fn(async () =>
        Response.json(
          {
            code: "RATE_LIMITED",
            message: "分析请求过于频繁，请稍后重试。",
            request_id: "request-1",
            retryable: true,
          },
          { status: 429 },
        ),
      ) as unknown as typeof fetch,
    });

    await expect(provider.quick(context)).rejects.toThrow(
      "分析请求过于频繁，请稍后重试。",
    );
  });
});
