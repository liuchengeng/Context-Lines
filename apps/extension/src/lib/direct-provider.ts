import {
  QuickAskAnswerSchema,
  type QuickAskAnswer,
} from "@contextlines/contracts";
import { z } from "zod";

const CONFIG_KEY = "providerConfig";
const DOUBAO_URL =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
const DOUBAO_RESOURCE_ID = "volc.bigasr.sauc.duration";
const DOUBAO_AUTH_RULE_ID = 9_001;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const AUDIO_CHUNK_BYTES = 6_400;

export type ProviderConfig = {
  doubaoAppId: string;
  doubaoAccessToken: string;
  deepseekApiKey: string;
};

const DeepSeekResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

const DoubaoPayloadSchema = z
  .object({
    code: z.number().optional(),
    message: z.string().optional(),
    payload_msg: z.unknown().optional(),
    result: z.unknown().optional(),
    text: z.string().optional(),
  })
  .passthrough();

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  const raw = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] as
    Partial<ProviderConfig> | undefined;
  const doubaoAppId = raw?.doubaoAppId?.trim() ?? "";
  const doubaoAccessToken = raw?.doubaoAccessToken?.trim() ?? "";
  const deepseekApiKey = raw?.deepseekApiKey?.trim() ?? "";
  return doubaoAppId && doubaoAccessToken && deepseekApiKey
    ? { doubaoAppId, doubaoAccessToken, deepseekApiKey }
    : null;
}

export async function saveProviderConfig(
  config: ProviderConfig,
): Promise<void> {
  await chrome.storage.local.set({
    [CONFIG_KEY]: {
      doubaoAppId: config.doubaoAppId.trim(),
      doubaoAccessToken: config.doubaoAccessToken.trim(),
      deepseekApiKey: config.deepseekApiKey.trim(),
    },
  });
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function extractPcmFromWav(
  wav: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  if (
    wav.length < 44 ||
    ascii(wav, 0, 4) !== "RIFF" ||
    ascii(wav, 8, 4) !== "WAVE"
  ) {
    throw new Error("最近音频的 WAV 格式无效，请重新开始监听。");
  }
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkName = ascii(wav, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > wav.length) break;
    if (chunkName === "data") return wav.slice(dataStart, dataEnd);
    offset = dataEnd + (chunkSize % 2);
  }
  throw new Error("最近音频中没有可识别的 PCM 数据。");
}

function makePacket(
  messageType: number,
  flags: number,
  serialization: number,
  payload: Uint8Array,
  sequence?: number,
): ArrayBuffer {
  const hasSequence = (flags & 0b0001) !== 0;
  const packet = new Uint8Array(
    4 + (hasSequence ? 4 : 0) + 4 + payload.byteLength,
  );
  packet[0] = 0x11;
  packet[1] = (messageType << 4) | flags;
  packet[2] = serialization << 4;
  packet[3] = 0;
  const view = new DataView(packet.buffer);
  let offset = 4;
  if (hasSequence) {
    view.setInt32(offset, sequence ?? 0, false);
    offset += 4;
  }
  view.setUint32(offset, payload.byteLength, false);
  packet.set(payload, offset + 4);
  return packet.buffer;
}

export function makeDoubaoRequestPacket(): ArrayBuffer {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      user: { uid: crypto.randomUUID() },
      audio: {
        language: "en-US",
        format: "pcm",
        codec: "raw",
        rate: 16_000,
        bits: 16,
        channel: 1,
      },
      request: {
        model_name: "bigmodel",
        enable_itn: true,
        enable_punc: true,
        enable_ddc: false,
        show_utterances: true,
      },
    }),
  );
  return makePacket(0b0001, 0, 0b0001, payload);
}

export function makeDoubaoAudioPacket(
  audio: Uint8Array,
  sequence: number,
  isLast: boolean,
): ArrayBuffer {
  return makePacket(
    0b0010,
    isLast ? 0b0011 : 0b0001,
    0,
    audio,
    isLast ? -sequence : sequence,
  );
}

async function decodePayload(
  bytes: Uint8Array<ArrayBuffer>,
  compression: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (compression === 0) return bytes;
  if (compression !== 1) throw new Error("豆包返回了不支持的压缩格式。");
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function parseDoubaoPacket(data: ArrayBuffer): Promise<unknown> {
  const bytes = new Uint8Array(data);
  if (bytes.length < 8) throw new Error("豆包返回的数据包不完整。");
  const messageType = bytes[1]! >> 4;
  const flags = bytes[1]! & 0x0f;
  const compression = bytes[2]! & 0x0f;
  const view = new DataView(data);
  let offset = (bytes[0]! & 0x0f) * 4;

  if (messageType === 0b1111) {
    if (offset + 8 > bytes.length)
      throw new Error("豆包语音识别返回协议错误。");
    const code = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, false);
    const message = new TextDecoder().decode(
      bytes.subarray(offset + 8, offset + 8 + size),
    );
    throw new Error(`豆包语音识别失败（${code}）：${message || "未知错误"}`);
  }
  if (messageType !== 0b1001) return null;
  let sequence: number | undefined;
  if ((flags & 0b0001) !== 0) {
    sequence = view.getInt32(offset, false);
    offset += 4;
  }
  if (offset + 4 > bytes.length) throw new Error("豆包返回的数据包不完整。");
  const size = view.getUint32(offset, false);
  const payload = bytes.slice(offset + 4, offset + 4 + size);
  const decoded = await decodePayload(payload, compression);
  try {
    const json = JSON.parse(new TextDecoder().decode(decoded)) as unknown;
    if (
      json &&
      typeof json === "object" &&
      ("payload_msg" in json || "is_last_package" in json)
    ) {
      return json;
    }
    return {
      code: 0,
      is_last_package: (flags & 0b0010) !== 0 || (sequence ?? 0) < 0,
      payload_sequence: sequence,
      payload_msg: json,
    };
  } catch {
    throw new Error("豆包返回的识别结果格式无效。");
  }
}

function nestedRecord(value: unknown, key: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function extractTranscript(value: unknown): string {
  const parsed = DoubaoPayloadSchema.safeParse(value);
  if (!parsed.success) return "";
  const root = parsed.data;
  if (typeof root.code === "number" && root.code !== 0) {
    throw new Error(
      `豆包语音识别失败（${root.code}）：${root.message ?? "请检查服务权限"}`,
    );
  }
  const payload = root.payload_msg ?? root;
  const result = nestedRecord(payload, "result");
  const candidates = [
    nestedRecord(result, "text"),
    Array.isArray(result) ? nestedRecord(result[0], "text") : undefined,
    nestedRecord(payload, "text"),
    root.text,
  ];
  return (
    candidates.find((candidate): candidate is string =>
      Boolean(typeof candidate === "string" && candidate.trim()),
    ) ?? ""
  ).trim();
}

async function installDoubaoHeaders(
  appId: string,
  accessToken: string,
  requestId: string,
): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [DOUBAO_AUTH_RULE_ID],
    addRules: [
      {
        id: DOUBAO_AUTH_RULE_ID,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "X-Api-App-Key",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: appId,
            },
            {
              header: "X-Api-Access-Key",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: accessToken,
            },
            {
              header: "X-Api-Resource-Id",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: DOUBAO_RESOURCE_ID,
            },
            {
              header: "X-Api-Request-Id",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: requestId,
            },
            {
              header: "X-Api-Sequence",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: "-1",
            },
          ],
        },
        condition: {
          urlFilter: "||openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream",
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.WEBSOCKET],
        },
      },
    ],
  });
}

async function removeDoubaoHeaders(): Promise<void> {
  await chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [DOUBAO_AUTH_RULE_ID] })
    .catch(() => undefined);
}

async function transcribeOnce(
  audioBase64: string,
  appId: string,
  accessToken: string,
): Promise<string> {
  const pcm = extractPcmFromWav(decodeBase64(audioBase64));
  if (pcm.byteLength === 0) throw new Error("刚才没有可识别的声音。");
  const requestId = crypto.randomUUID();
  await installDoubaoHeaders(appId, accessToken, requestId);

  try {
    return await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(DOUBAO_URL);
      socket.binaryType = "arraybuffer";
      let latestTranscript = "";
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else if (latestTranscript) resolve(latestTranscript);
        else reject(new Error("刚才没有识别到清晰英语。"));
      };
      const timeout = setTimeout(() => {
        socket.close();
        finish(new Error("豆包语音识别超时，请稍后重试。"));
      }, 20_000);

      socket.onopen = () => {
        socket.send(makeDoubaoRequestPacket());
        const count = Math.ceil(pcm.byteLength / AUDIO_CHUNK_BYTES);
        for (let index = 0; index < count; index += 1) {
          const start = index * AUDIO_CHUNK_BYTES;
          const chunk = pcm.slice(start, start + AUDIO_CHUNK_BYTES);
          socket.send(
            makeDoubaoAudioPacket(chunk, index + 1, index === count - 1),
          );
        }
      };
      socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        void parseDoubaoPacket(event.data).then(
          (payload) => {
            const transcript = extractTranscript(payload);
            if (transcript) latestTranscript = transcript;
            const isLast = nestedRecord(payload, "is_last_package") === true;
            if (isLast) {
              socket.close();
              finish();
            }
          },
          (error: unknown) => {
            socket.close();
            finish(
              error instanceof Error
                ? error
                : new Error("豆包语音识别返回异常。"),
            );
          },
        );
      };
      socket.onerror = () => {
        finish(
          new Error(
            "豆包 WebSocket 连接失败，请确认 APP ID、Access Token 与小时版服务属于同一个应用。",
          ),
        );
      };
      socket.onclose = () => finish();
    });
  } finally {
    await removeDoubaoHeaders();
  }
}

let transcriptionTail: Promise<unknown> = Promise.resolve();

async function transcribe(
  audioBase64: string,
  appId: string,
  accessToken: string,
): Promise<string> {
  const task = transcriptionTail.then(() =>
    transcribeOnce(audioBase64, appId, accessToken),
  );
  transcriptionTail = task.catch(() => undefined);
  return task;
}

export async function answerWithProviders(
  audioBase64: string,
  config: ProviderConfig,
  pageTitle?: string,
): Promise<QuickAskAnswer> {
  const transcript = await transcribe(
    audioBase64,
    config.doubaoAppId,
    config.doubaoAccessToken,
  );
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
