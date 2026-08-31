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

const DoubaoAsrResponseSchema = z.object({
  result: z.object({ text: z.string() }),
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

async function transcribeWithDoubao(
  env: Env,
  input: QuickAskRequest,
): Promise<string> {
  const endpoint = required(env.DOUBAO_ASR_URL, "豆包极速识别地址");
  const resourceId = required(env.DOUBAO_ASR_RESOURCE_ID, "豆包资源 ID");
  const model = required(env.DOUBAO_ASR_MODEL, "豆包 ASR 模型");
  const apiKey = env.DOUBAO_API_KEY?.trim();
  const appKey = env.DOUBAO_APP_KEY?.trim();
  const accessKey = env.DOUBAO_ACCESS_KEY?.trim();
  if (!apiKey && !(appKey && accessKey)) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "豆包语音凭证尚未配置。",
      false,
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Resource-Id": resourceId,
      "X-Api-Request-Id": crypto.randomUUID(),
      "X-Api-Sequence": "-1",
      ...(apiKey
        ? { "X-Api-Key": apiKey }
        : {
            "X-Api-App-Key": appKey!,
            "X-Api-Access-Key": accessKey!,
          }),
    },
    body: JSON.stringify({
      user: { uid: apiKey ?? appKey },
      audio: { data: input.audio_base64 },
      request: {
        model_name: model,
        enable_itn: true,
        enable_punc: true,
      },
    }),
  });

  const statusCode = response.headers.get("X-Api-Status-Code");
  if (statusCode === "20000003" || statusCode === "45000002") {
    throw new HttpError(
      422,
      "NO_SPEECH",
      "刚才的片段里没有识别到清晰英语。",
      false,
    );
  }
  if (statusCode === "55000031" || response.status === 429) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "豆包语音服务繁忙，请稍后重试。",
      true,
    );
  }
  if (!response.ok || statusCode !== "20000000") {
    throw new HttpError(
      502,
      "ASR_UPSTREAM_ERROR",
      "豆包语音识别暂时不可用，请稍后重试。",
      true,
    );
  }

  const raw: unknown = await response.json().catch(() => null);
  const parsed = DoubaoAsrResponseSchema.safeParse(raw);
  const transcript = parsed.success ? parsed.data.result.text.trim() : "";
  if (!transcript) {
    throw new HttpError(
      502,
      "INVALID_UPSTREAM_RESPONSE",
      "豆包语音返回了无效结果。",
      true,
    );
  }
  return transcript;
}

export async function answerQuickAsk(
  env: Env,
  input: QuickAskRequest,
): Promise<QuickAskAnswer> {
  const transcript = await transcribeWithDoubao(env, input);

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
