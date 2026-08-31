import { describe, expect, it } from "vitest";

import type { ApiClient } from "../src/lib/api-client";
import { OpenAIRealtimeTransport } from "../src/lib/realtime-transport";

describe("OpenAIRealtimeTransport", () => {
  it("rejects an expired short-lived credential before creating WebRTC", async () => {
    const apiClient = {
      createRealtimeClientSecret: async () => ({
        value: `ek_${"a".repeat(40)}`,
        expires_at: Math.floor(Date.now() / 1_000) - 1,
        model: "configured-model",
      }),
    } as ApiClient;
    const transport = new OpenAIRealtimeTransport(apiClient);
    const stream = {
      getAudioTracks: () => [{} as MediaStreamTrack],
    } as MediaStream;

    await expect(
      transport.connect(stream, {
        onEvent: () => undefined,
        onDisconnected: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "realtime", retryable: true });
  });
});
