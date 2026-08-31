import {
  QuickAskAnswerSchema,
  type QuickAskAnswer,
  type QuickAskRequest,
} from "@contextlines/contracts";
import { z } from "zod";
import { HttpError } from "./http";

const UpstreamMessageSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(z.object({ text: z.string() }).passthrough()),
          ]),
        }),
      }),
    )
    .min(1),
});

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized)
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      `${label} 尚未配置。`,
      false,
    );
  return normalized;
}

async function upstreamJson(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
      "问答服务暂时不可用，请稍后重试。",
      true,
    );
  }
  return response.json().catch(() => {
    throw new HttpError(
      502,
      "INVALID_UPSTREAM_RESPONSE",
      "模型返回了无效结果。",
      true,
    );
  });
}

function messageText(payload: unknown): string {
  const parsed = UpstreamMessageSchema.safeParse(payload);
  if (!parsed.success)
    throw new HttpError(
      502,
      "INVALID_UPSTREAM_RESPONSE",
      "模型返回了无效结果。",
      true,
    );
  const content = parsed.data.choices[0]?.message.content;
  if (typeof content === "string") return content.trim();
  return (
    content
      ?.map((part) => part.text)
      .join(" ")
      .trim() ?? ""
  );
}

export async function answerQuickAsk(
  env: Env,
  input: QuickAskRequest,
): Promise<QuickAskAnswer> {
  const qwenBaseUrl = required(env.QWEN_ASR_BASE_URL, "Qwen ASR 地址").replace(
    /\/$/,
    "",
  );
  const qwenModel = required(env.QWEN_ASR_MODEL, "Qwen ASR 模型");
  const qwenPayload = await upstreamJson(
    `${qwenBaseUrl}/chat/completions`,
    required(env.DASHSCOPE_API_KEY, "DashScope API Key"),
    {
      model: qwenModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: `data:${input.mime_type};base64,${input.audio_base64}`,
              },
            },
          ],
        },
      ],
      stream: false,
      asr_options: { enable_itn: true },
    },
  );
  const transcript = messageText(qwenPayload);
  if (!transcript)
    throw new HttpError(
      422,
      "NO_SPEECH",
      "刚才的片段里没有识别到清晰英语。",
      false,
    );

  const deepSeekBaseUrl = required(
    env.DEEPSEEK_BASE_URL,
    "DeepSeek 地址",
  ).replace(/\/$/, "");
  const deepSeekPayload = await upstreamJson(
    `${deepSeekBaseUrl}/chat/completions`,
    required(env.DEEPSEEK_API_KEY, "DeepSeek API Key"),
    {
      model: required(env.DEEPSEEK_MODEL, "DeepSeek 模型"),
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            '你是英语影视台词快速解释助手。只关注最后一句或最值得解释的短语/俚语。用简短自然中文回答，不补造剧情。输出严格 JSON，格式示例：{"transcript":"原英文","phrase":"核心短语","meaning_zh":"简短含义","context_zh":"在这句话里的意思","usage_zh":"常见用法"}。',
        },
        {
          role: "user",
          content: JSON.stringify({
            transcript,
            page_title: input.page_title ?? "",
            page_origin: input.page_origin ?? "",
          }),
        },
      ],
    },
  );
  const rawAnswer = messageText(deepSeekPayload);
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawAnswer);
  } catch {
    throw new HttpError(
      502,
      "INVALID_MODEL_OUTPUT",
      "解释结果格式无效，请重试。",
      true,
    );
  }
  const parsed = QuickAskAnswerSchema.safeParse(decoded);
  if (!parsed.success)
    throw new HttpError(
      502,
      "INVALID_MODEL_OUTPUT",
      "解释结果格式无效，请重试。",
      true,
    );
  return parsed.data;
}
