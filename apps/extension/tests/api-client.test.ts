import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "../src/lib/api-client";

function client(fetcher: typeof fetch, token: string | null = "access-token") {
  return new ApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: async () => token,
    fetcher,
  });
}

describe("ApiClient", () => {
  it("rejects capture when no signed-in session exists", async () => {
    await expect(
      client(
        vi.fn() as unknown as typeof fetch,
        null,
      ).createRealtimeClientSecret(),
    ).rejects.toMatchObject({ code: "not-signed-in", retryable: false });
  });

  it("maps network and expired-session failures to safe capture errors", async () => {
    const network = client(
      vi.fn(async () => {
        throw new TypeError("private upstream detail");
      }) as unknown as typeof fetch,
    );
    await expect(network.createRealtimeClientSecret()).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });

    const unauthorized = client(
      vi.fn(async () =>
        Response.json(
          {
            code: "INVALID_SESSION",
            message: "登录已失效，请重新登录。",
            request_id: "request-1",
            retryable: false,
          },
          { status: 401 },
        ),
      ) as unknown as typeof fetch,
    );
    await expect(
      unauthorized.createRealtimeClientSecret(),
    ).rejects.toMatchObject({ code: "not-signed-in", retryable: false });
  });

  it("rejects a malformed credential response", async () => {
    const malformed = client(
      vi.fn(async () =>
        Response.json({ value: "short" }),
      ) as unknown as typeof fetch,
    );
    await expect(malformed.createRealtimeClientSecret()).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });
  });
});
