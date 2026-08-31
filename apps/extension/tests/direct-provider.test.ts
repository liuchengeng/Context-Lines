import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerWithProviders,
  extractPcmFromWav,
  extractTranscript,
  makeDoubaoAudioPacket,
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

describe("direct provider", () => {
  it("extracts PCM and marks the final audio packet without a sequence", async () => {
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

  it("streams the clip to Doubao and sends only its transcript to DeepSeek", async () => {
    const updateSessionRules = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      declarativeNetRequest: {
        updateSessionRules,
        RuleActionType: { MODIFY_HEADERS: "modifyHeaders" },
        HeaderOperation: { SET: "set" },
        ResourceType: { WEBSOCKET: "websocket" },
      },
    });

    const openedUrls: string[] = [];
    class MockWebSocket {
      binaryType = "blob";
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor(url: string) {
        openedUrls.push(url);
        queueMicrotask(() => this.onopen?.());
      }

      send(data: ArrayBuffer) {
        const bytes = new Uint8Array(data);
        if (bytes[1] === 0x22) {
          queueMicrotask(() => {
            this.onmessage?.(
              new MessageEvent("message", {
                data: makeServerPacket({
                  result: { text: "Not a chance." },
                }),
              }),
            );
            this.onclose?.({ code: 1000, reason: "" } as CloseEvent);
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

    const fetchMock = vi.fn().mockResolvedValue(
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

    const wav = new Uint8Array(
      encodeMonoWav(new Float32Array(320).fill(0.2), 16_000),
    );
    const answer = await answerWithProviders(
      Buffer.from(wav).toString("base64"),
      {
        doubaoAppId: "123456789",
        doubaoAccessToken: "doubao-token",
        deepseekApiKey: "deepseek-key",
      },
      "Video",
    );

    expect(answer.phrase).toBe("not a chance");
    expect(openedUrls[0]).toContain("bigmodel_nostream");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("Not a chance.");
    expect(updateSessionRules).toHaveBeenCalledTimes(2);
    expect(updateSessionRules.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        addRules: [
          expect.objectContaining({
            action: expect.objectContaining({
              requestHeaders: expect.arrayContaining([
                expect.objectContaining({
                  header: "X-Api-App-Key",
                  value: "123456789",
                }),
                expect.objectContaining({
                  header: "X-Api-Access-Key",
                  value: "doubao-token",
                }),
                expect.objectContaining({
                  header: "X-Api-Resource-Id",
                  value: "volc.bigasr.sauc.duration",
                }),
                expect.objectContaining({
                  header: "X-Api-Connect-Id",
                }),
              ]),
            }),
            condition: expect.objectContaining({
              urlFilter:
                "||openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream",
              resourceTypes: ["websocket"],
            }),
          }),
        ],
      }),
    );
    expect(updateSessionRules.mock.calls[1]?.[0]).toEqual({
      removeRuleIds: [9001],
    });
  });
});
