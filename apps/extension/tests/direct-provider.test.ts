import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerWithProviders,
  extractPcmFromWav,
  extractTranscript,
  makeDoubaoAudioPacket,
  loadProviderConfig,
  normalizeRelayBaseUrl,
  relayControlError,
  relayWebSocketUrl,
} from "../src/lib/direct-provider";
import { encodeMonoWav } from "../src/lib/audio-ring-buffer";

function makeServerPacket(payload: unknown): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packet = new Uint8Array(12 + json.byteLength);
  packet[0] = 0x11;
  packet[1] = 0x93;
  packet[2] = 0x10;
  const view = new DataView(packet.buffer);
  view.setInt32(4, -1, false);
  view.setUint32(8, json.byteLength, false);
  packet.set(json, 12);
  return packet.buffer;
}

afterEach(() => vi.unstubAllGlobals());

describe("relay provider", () => {
  it("decodes relay errors and preserves unexpected plain text", () => {
    expect(
      relayControlError(
        `contextlines-error:${encodeURIComponent("豆包鉴权失败。")}`,
      )?.message,
    ).toBe("豆包鉴权失败。");
    expect(relayControlError("upstream unavailable")?.message).toBe(
      "中转服务收到纯文本：upstream unavailable",
    );
  });

  it("removes legacy model secrets from Chrome storage", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            providerConfig: {
              doubaoAppId: "123",
              doubaoAccessToken: "old-doubao-token",
              deepseekApiKey: "old-deepseek-key",
            },
          }),
          remove,
        },
      },
    });
    expect(await loadProviderConfig()).toBeNull();
    expect(remove).toHaveBeenCalledWith("providerConfig");
  });

  it("normalizes HTTPS relay URLs and creates the WebSocket endpoint", () => {
    expect(normalizeRelayBaseUrl("https://demo.workers.dev/")).toBe(
      "https://demo.workers.dev",
    );
    expect(relayWebSocketUrl("https://demo.workers.dev")).toBe(
      "wss://demo.workers.dev/v1/doubao",
    );
    expect(() => normalizeRelayBaseUrl("http://example.com")).toThrow("HTTPS");
  });

  it("extracts PCM and marks the final audio packet", async () => {
    const wav = new Uint8Array(
      encodeMonoWav(new Float32Array([0, 0.5, -0.5]), 16_000),
    );
    expect(extractPcmFromWav(wav)).toHaveLength(6);

    const packet = new Uint8Array(
      await makeDoubaoAudioPacket(new Uint8Array([1, 2]), true),
    );
    expect(packet[1]).toBe(0x22);
    expect(packet[2]).toBe(0x01);
    expect(new DataView(packet.buffer).getUint32(4, false)).toBe(
      packet.byteLength - 8,
    );
  });

  it("reads current and wrapped Doubao transcript shapes", () => {
    expect(extractTranscript({ result: { text: "Not a chance." } })).toBe(
      "Not a chance.",
    );
    expect(
      extractTranscript({
        code: 0,
        is_last_package: true,
        payload_msg: { result: { text: "Read into it." } },
      }),
    ).toBe("Read into it.");
  });

  it("uses the relay subprotocol and sends only transcript metadata to explain", async () => {
    const opened: Array<{ url: string; protocols: string[] }> = [];
    class MockWebSocket {
      binaryType = "blob";
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor(url: string, protocols: string[]) {
        opened.push({ url, protocols });
        queueMicrotask(() => this.onopen?.());
      }

      send(data: ArrayBuffer) {
        const bytes = new Uint8Array(data);
        if (bytes[1] === 0x22) {
          queueMicrotask(() => {
            this.onmessage?.(
              new MessageEvent("message", {
                data: makeServerPacket({ result: { text: "Not a chance." } }),
              }),
            );
          });
        }
      }

      close() {
        queueMicrotask(() =>
          this.onclose?.({ code: 1000, reason: "" } as CloseEvent),
        );
      }
    }
    vi.stubGlobal("WebSocket", MockWebSocket);

    const answer = {
      transcript: "Not a chance.",
      explanations: [{ phrase: "Not a chance", meaning_zh: "想都别想" }],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(answer), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wav = new Uint8Array(
      encodeMonoWav(new Float32Array(320).fill(0.2), 16_000),
    );
    const result = await answerWithProviders(
      Buffer.from(wav).toString("base64"),
      {
        relayUrl: "https://demo.workers.dev",
        relayToken: "abcdefghijklmnopqrstuvwxyz123456",
      },
      "Video",
    );

    expect(result.explanations[0]?.phrase).toBe("Not a chance");
    expect(opened).toEqual([
      {
        url: "wss://demo.workers.dev/v1/doubao",
        protocols: ["contextlines", "abcdefghijklmnopqrstuvwxyz123456"],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo.workers.dev/v1/explain",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
        }),
        body: JSON.stringify({
          transcript: "Not a chance.",
          page_title: "Video",
        }),
      }),
    );
  });
});
