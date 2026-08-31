import {
  QuickAskAnswerSchema,
  type QuickAskAnswer,
} from "@contextlines/contracts";
import { z } from "zod";

const CONFIG_KEY = "providerConfig";
const DOUBAO_URL =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export type ProviderConfig = {
  doubaoApiKey: string;
  deepseekApiKey: string;
};

const DoubaoResponseSchema = z.object({
  result: z.object({ text: z.string() }),
});
const DeepSeekResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  const raw = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] as
    Partial<ProviderConfig> | undefined;
  const doubaoApiKey = raw?.doubaoApiKey?.trim() ?? "";
  const deepseekApiKey = raw?.deepseekApiKey?.trim() ?? "";
  return doubaoApiKey && deepseekApiKey
    ? { doubaoApiKey, deepseekApiKey }
    : null;
}

export async function saveProviderConfig(
  config: ProviderConfig,
): Promise<void> {
  await chrome.storage.local.set({
    [CONFIG_KEY]: {
      doubaoApiKey: config.doubaoApiKey.trim(),
      deepseekApiKey: config.deepseekApiKey.trim(),
    },
  });
}

async function transcribe(
  audioBase64: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Api-Resource-Id": "volc.bigasr.auc_turbo",
      "X-Api-Request-Id": crypto.randomUUID(),
      "X-Api-Sequence": "-1",
    },
    body: JSON.stringify({
      user: { uid: apiKey },
      audio: { data: audioBase64 },
      request: { model_name: "bigmodel", enable_itn: true, enable_punc: true },
    }),
  });
  const code = response.headers.get("X-Api-Status-Code");
  if (code === "20000003" || code === "45000002")
    throw new Error("刚才没有识别到清晰英语。");
  if (code === "55000031" || response.status === 429)
    throw new Error("豆包语音服务繁忙，请稍后重试。");
  if (!response.ok || code !== "20000000")
    throw new Error("豆包语音识别失败，请检查 App Key 和服务权限。");
  const parsed = DoubaoResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  const text = parsed.success ? parsed.data.result.text.trim() : "";
  if (!text) throw new Error("豆包语音没有返回有效转写。");
  return text;
}

export async function answerWithProviders(
  audioBase64: string,
  config: ProviderConfig,
  pageTitle?: string,
): Promise<QuickAskAnswer> {
  const transcript = await transcribe(audioBase64, config.doubaoApiKey);
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            '你是英语影视台词快速解释助手。只关注最后一句或最值得解释的短语/俚语。用简短自然中文回答，不补造剧情。输出严格 JSON：{"transcript":"原英文","phrase":"核心短语","meaning_zh":"简短含义","context_zh":"在这句话里的意思","usage_zh":"常见用法"}。',
        },
        {
          role: "user",
          content: JSON.stringify({ transcript, page_title: pageTitle ?? "" }),
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "DeepSeek API Key 无效。"
        : "DeepSeek 解释服务暂时不可用。",
    );
  const upstream = DeepSeekResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  const content = upstream.success
    ? upstream.data.choices[0]?.message.content
    : null;
  if (!content) throw new Error("DeepSeek 没有返回有效解释。");
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new Error("DeepSeek 返回的解释格式无效。");
  }
  const parsed = QuickAskAnswerSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("DeepSeek 返回的解释缺少必要内容。");
  return parsed.data;
}
