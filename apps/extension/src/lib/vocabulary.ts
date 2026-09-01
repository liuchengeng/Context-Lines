import {
  SaveVocabularyItemSchema,
  VocabularyItemSchema,
  VocabularyListSchema,
  type SaveVocabularyItem,
  type VocabularyItem,
  type VocabularyKind,
} from "@contextlines/contracts";
import { loadProviderConfig, relayHttpUrl } from "./direct-provider";

function responseMessage(value: unknown, fallback: string): string {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

async function vocabularyRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const config = await loadProviderConfig();
  if (!config) {
    throw new Error("请先在扩展设置中连接个人 Worker。");
  }
  const response = await fetch(relayHttpUrl(config.relayUrl, path), {
    ...init,
    headers: {
      Authorization: `Bearer ${config.relayToken}`,
      ...init?.headers,
    },
  });
  const decoded = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(responseMessage(decoded, "词单服务暂时不可用。"));
  }
  return decoded;
}

export function vocabularyKindForTerm(term: string): VocabularyKind {
  return /\s/.test(term.trim()) ? "phrase" : "word";
}

export async function saveVocabularyItem(
  value: SaveVocabularyItem,
): Promise<VocabularyItem> {
  const input = SaveVocabularyItemSchema.safeParse(value);
  if (!input.success) throw new Error("收藏内容无效。");
  const decoded = await vocabularyRequest("/v1/vocabulary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.data),
  });
  const item =
    decoded && typeof decoded === "object" && "item" in decoded
      ? decoded.item
      : null;
  const parsed = VocabularyItemSchema.safeParse(item);
  if (!parsed.success) throw new Error("词单服务返回的词条格式无效。");
  return parsed.data;
}

export async function listVocabularyItems(): Promise<VocabularyItem[]> {
  const decoded = await vocabularyRequest("/v1/vocabulary");
  const parsed = VocabularyListSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("词单服务返回的列表格式无效。");
  return parsed.data.items;
}

export async function deleteVocabularyItem(id: string): Promise<void> {
  await vocabularyRequest(`/v1/vocabulary/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
