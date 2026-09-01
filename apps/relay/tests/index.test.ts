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

type VocabularyRow = {
  id: string;
  term: string;
  normalized_term: string;
  meaning_zh: string;
  kind: "word" | "phrase";
  created_at: string;
  updated_at: string;
};

function createVocabularyDatabase(): D1Database {
  const rows = new Map<string, VocabularyRow>();
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        async run() {
          if (sql.startsWith("INSERT INTO vocabulary_items")) {
            const [
              id,
              term,
              normalizedTerm,
              meaningZh,
              kind,
              createdAt,
              updatedAt,
            ] = values as [
              string,
              string,
              string,
              string,
              "word" | "phrase",
              string,
              string,
            ];
            const existing = rows.get(normalizedTerm);
            rows.set(normalizedTerm, {
              id: existing?.id ?? id,
              term,
              normalized_term: normalizedTerm,
              meaning_zh: meaningZh,
              kind,
              created_at: existing?.created_at ?? createdAt,
              updated_at: updatedAt,
            });
          } else if (sql.startsWith("DELETE FROM vocabulary_items")) {
            const [id] = values as [string];
            for (const [key, row] of rows) {
              if (row.id === id) rows.delete(key);
            }
          }
          return { success: true };
        },
        async first() {
          const [normalizedTerm] = values as [string];
          const row = rows.get(normalizedTerm);
          if (!row) return null;
          const { normalized_term: _normalizedTerm, ...item } = row;
          return item;
        },
        async all() {
          return {
            results: Array.from(rows.values())
              .sort((left, right) =>
                right.updated_at.localeCompare(left.updated_at),
              )
              .map(({ normalized_term: _normalizedTerm, ...item }) => item),
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

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

  it("keeps the translation when no phrase needs explanation", async () => {
    const modelAnswer = {
      translation_zh: "谢谢。",
      explanations: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelAnswer) } }],
        }),
        { status: 200 },
      ),
    );
    const response = await worker.fetch(
      request("/v1/explain", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RELAY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: "Thank you." }),
      }),
      env,
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      transcript: "Thank you.",
      translation_zh: "谢谢。",
      explanations: [],
    });
  });

  it.each([
    ["omits explanations", { translation_zh: "谢谢。" }],
    [
      "returns malformed explanations",
      {
        translation_zh: "谢谢。",
        explanations: [{ phrase: "", meaning_zh: "" }, "invalid"],
      },
    ],
  ])("keeps valid Chinese when DeepSeek %s", async (_name, modelAnswer) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelAnswer) } }],
        }),
        { status: 200 },
      ),
    );
    const response = await worker.fetch(
      request("/v1/explain", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RELAY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: "Thank you." }),
      }),
      env,
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      transcript: "Thank you.",
      translation_zh: "谢谢。",
      explanations: [],
    });
  });

  it("reports when the personal vocabulary database is not configured", async () => {
    const response = await worker.fetch(
      request("/v1/vocabulary", {
        headers: { Authorization: `Bearer ${env.RELAY_TOKEN}` },
      }),
      env,
      context,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "vocabulary_not_configured" }),
    );
  });

  it("saves, deduplicates, lists, and deletes selected vocabulary", async () => {
    const vocabularyEnv = { ...env, VOCAB_DB: createVocabularyDatabase() };
    const save = (term: string, meaning_zh: string) =>
      worker.fetch(
        request("/v1/vocabulary", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RELAY_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ term, meaning_zh, kind: "phrase" }),
        }),
        vocabularyEnv,
        context,
      );

    expect((await save("No end of", "很多")).status).toBe(200);
    expect((await save("no   end of", "没完没了")).status).toBe(200);

    const list = await worker.fetch(
      request("/v1/vocabulary", {
        headers: { Authorization: `Bearer ${env.RELAY_TOKEN}` },
      }),
      vocabularyEnv,
      context,
    );
    const listed = (await list.json()) as {
      items: Array<{ id: string; term: string; meaning_zh: string }>;
    };
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toEqual(
      expect.objectContaining({
        term: "no end of",
        meaning_zh: "没完没了",
      }),
    );

    const deleted = await worker.fetch(
      request(`/v1/vocabulary/${listed.items[0]!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.RELAY_TOKEN}` },
      }),
      vocabularyEnv,
      context,
    );
    expect(deleted.status).toBe(200);
    const emptyList = await worker.fetch(
      request("/v1/vocabulary", {
        headers: { Authorization: `Bearer ${env.RELAY_TOKEN}` },
      }),
      vocabularyEnv,
      context,
    );
    expect(await emptyList.json()).toEqual({ items: [] });
  });
});
