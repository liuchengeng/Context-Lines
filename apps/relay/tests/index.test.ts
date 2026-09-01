import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  DOUBAO_RESOURCE_ID,
  normalizeBinaryFrame,
  parseRelaySubprotocol,
  type Env,
} from "../src/index";

const env: Env = {
  DOUBAO_APP_ID: "123456789",
  DOUBAO_ACCESS_TOKEN: "doubao-token",
  DEEPSEEK_API_KEY: "deepseek-key",
  RELAY_TOKEN: "abcdefghijklmnopqrstuvwxyz123456",
};

const context = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

function request(path: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("Origin", "chrome-extension://abcdefghijklmnop");
  return new Request(`https://relay.example${path}`, { ...init, headers });
}

afterEach(() => vi.restoreAllMocks());

describe("relay worker", () => {
  it("converts Cloudflare Blob WebSocket frames back to binary", async () => {
    const normalized = await normalizeBinaryFrame(
      new Blob([new Uint8Array([0x11, 0x93, 0x10, 0x00])]),
    );
    expect(Array.from(new Uint8Array(normalized as ArrayBuffer))).toEqual([
      0x11, 0x93, 0x10, 0x00,
    ]);
  });

  it("targets the enabled Doubao ASR 2.0 hourly resource", () => {
    expect(DOUBAO_RESOURCE_ID).toBe("volc.seedasr.sauc.duration");
  });

  it("accepts only the expected WebSocket protocol token", () => {
    expect(
      parseRelaySubprotocol(
        "contextlines, abcdefghijklmnopqrstuvwxyz123456",
        env.RELAY_TOKEN,
      ),
    ).toBe(true);
    expect(parseRelaySubprotocol("contextlines, wrong", env.RELAY_TOKEN)).toBe(
      false,
    );
  });

  it("reports health without exposing configuration", async () => {
    const response = await worker.fetch(request("/health"), env, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "contextlines-relay",
      version: "0.1.0",
    });
  });

  it("requires the relay token for protected routes", async () => {
    const response = await worker.fetch(request("/v1/config"), env, context);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "unauthorized" }),
    );
  });

  it("does not treat a missing secret as the literal token undefined", async () => {
    const response = await worker.fetch(
      request("/v1/config", {
        headers: { Authorization: "Bearer undefined" },
      }),
      { ...env, RELAY_TOKEN: undefined as unknown as string },
      context,
    );
    expect(response.status).toBe(401);
  });

  it("validates DeepSeek output before returning it", async () => {
    const modelAnswer = {
      translation_zh: "想都别想。",
      explanations: [{ phrase: "Not a chance", meaning_zh: "想都别想" }],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.max_tokens).toBe(220);
      expect(body.messages.at(-1)).toEqual({
        role: "user",
        content: "Not a chance.",
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelAnswer) } }],
        }),
        { status: 200 },
      );
    });
    const response = await worker.fetch(
      request("/v1/explain", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RELAY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: "Not a chance.",
        }),
      }),
      env,
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      transcript: "Not a chance.",
      translation_zh: modelAnswer.translation_zh,
      explanations: modelAnswer.explanations,
    });
  });
});
