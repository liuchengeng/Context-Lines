import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteVocabularyItem,
  listVocabularyItems,
  saveVocabularyItem,
  vocabularyKindForTerm,
} from "../src/lib/vocabulary";

const item = {
  id: "55e767a4-6450-4f6a-8248-855422e82ee6",
  term: "no end of",
  meaning_zh: "很多，没完没了",
  kind: "phrase" as const,
  created_at: "2026-09-01T06:00:00.000Z",
  updated_at: "2026-09-01T06:00:00.000Z",
};

function stubProviderConfig(): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({
          providerConfig: {
            relayUrl: "https://demo.workers.dev",
            relayToken: "abcdefghijklmnopqrstuvwxyz123456",
          },
        }),
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("personal vocabulary", () => {
  it("distinguishes single words from phrases", () => {
    expect(vocabularyKindForTerm("embarrassed")).toBe("word");
    expect(vocabularyKindForTerm("no end of")).toBe("phrase");
  });

  it("saves, lists, and deletes through the personal relay", async () => {
    stubProviderConfig();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ item }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [item] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await saveVocabularyItem({
        term: item.term,
        meaning_zh: item.meaning_zh,
        kind: item.kind,
      }),
    ).toEqual(item);
    expect(await listVocabularyItems()).toEqual([item]);
    await deleteVocabularyItem(item.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://demo.workers.dev/v1/vocabulary",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `https://demo.workers.dev/v1/vocabulary/${item.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
