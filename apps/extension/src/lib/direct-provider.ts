import {
  QuickAskAnswerSchema,
  type QuickAskAnswer,
} from "@contextlines/contracts";

const CONFIG_KEY = "providerConfig";
const AUDIO_CHUNK_BYTES = 6_400;
const RELAY_PROTOCOL = "contextlines";
const RELAY_ERROR_PREFIX = "contextlines-error:";
const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 12;

type CacheEntry<T> = { value: T; expiresAt: number };

const transcriptCache = new Map<string, CacheEntry<string>>();
const answerCache = new Map<string, CacheEntry<QuickAskAnswer>>();

export type ProviderConfig = {
  relayUrl: string;
  relayToken: string;
};

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
): void {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    cache.delete(oldestKey);
  }
}

async function audioFingerprint(audioBase64: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(audioBase64),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function transcriptCacheKey(config: ProviderConfig, audioHash: string): string {
  return `${config.relayUrl}\n${audioHash}`;
}

function answerCacheKey(config: ProviderConfig, transcript: string): string {
  return `${config.relayUrl}\n${transcript.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function clearProviderMemoryCache(): void {
  transcriptCache.clear();
  answerCache.clear();
}

export function normalizeRelayBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Worker 地址格式不正确。");
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Worker 地址必须使用 HTTPS。");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Worker 地址不能包含账号、查询参数或锚点。");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function relayWebSocketUrl(baseUrl: string): string {
  const url = new URL(normalizeRelayBaseUrl(baseUrl));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname}/v1/doubao`.replace(/\/+/g, "/");
  return url.toString();
}

function relayHttpUrl(baseUrl: string, path: string): string {
  const url = new URL(normalizeRelayBaseUrl(baseUrl));
  url.pathname = `${url.pathname}${path}`.replace(/\/+/g, "/");
  return url.toString();
}

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  const raw = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] as
    Record<string, unknown> | undefined;
  const relayUrl = typeof raw?.relayUrl === "string" ? raw.relayUrl.trim() : "";
  const relayToken =
    typeof raw?.relayToken === "string" ? raw.relayToken.trim() : "";
  if (!relayUrl || !relayToken) {
    if (
      raw &&
      ("doubaoAppId" in raw ||
        "doubaoAccessToken" in raw ||
        "deepseekApiKey" in raw)
    ) {
      await chrome.storage.local.remove(CONFIG_KEY);
    }
    return null;
  }
  try {
    return { relayUrl: normalizeRelayBaseUrl(relayUrl), relayToken };
  } catch {
    return null;
  }
}

export async function saveProviderConfig(
  config: ProviderConfig,
): Promise<void> {
  await chrome.storage.local.set({
    [CONFIG_KEY]: {
      relayUrl: normalizeRelayBaseUrl(config.relayUrl),
      relayToken: config.relayToken.trim(),
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

async function gzip(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const stream = new Blob([input.buffer])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function makePacket(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number,
  payload: Uint8Array,
): ArrayBuffer {
  const packet = new Uint8Array(8 + payload.byteLength);
  packet[0] = 0x11;
  packet[1] = (messageType << 4) | flags;
  packet[2] = (serialization << 4) | compression;
  packet[3] = 0;
  new DataView(packet.buffer).setUint32(4, payload.byteLength, false);
  packet.set(payload, 8);
  return packet.buffer;
}

export async function makeDoubaoRequestPacket(): Promise<ArrayBuffer> {
  const payload = await gzip(
    new TextEncoder().encode(
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
    ),
  );
  return makePacket(0b0001, 0, 0b0001, 0b0001, payload);
}

export async function makeDoubaoAudioPacket(
  audio: Uint8Array,
  isLast: boolean,
): Promise<ArrayBuffer> {
  return makePacket(0b0010, isLast ? 0b0010 : 0, 0, 0b0001, await gzip(audio));
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
  if (!value || typeof value !== "object") return "";
  const root = value as Record<string, unknown>;
  if (typeof root.code === "number" && root.code !== 0) {
    throw new Error(
      `豆包语音识别失败（${root.code}）：${typeof root.message === "string" ? root.message : "请检查服务权限"}`,
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

function measurePcmLevel(pcm: Uint8Array<ArrayBuffer>): {
  peak: number;
  rms: number;
} {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let peak = 0;
  let squares = 0;
  const samples = Math.floor(pcm.byteLength / 2);
  for (let offset = 0; offset + 1 < pcm.byteLength; offset += 2) {
    const value = view.getInt16(offset, true) / 0x8000;
    peak = Math.max(peak, Math.abs(value));
    squares += value * value;
  }
  return { peak, rms: samples ? Math.sqrt(squares / samples) : 0 };
}

function summarizeDoubaoPayload(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "无响应");
  const root = value as Record<string, unknown>;
  const payload =
    root.payload_msg && typeof root.payload_msg === "object"
      ? (root.payload_msg as Record<string, unknown>)
      : root;
  const result =
    payload.result && typeof payload.result === "object"
      ? (payload.result as Record<string, unknown>)
      : undefined;
  return JSON.stringify({
    code: root.code,
    message: root.message,
    text: result?.text,
    payload_keys: Object.keys(payload),
    result_keys: result ? Object.keys(result) : [],
  }).slice(0, 400);
}

export function relayControlError(value: string): Error | null {
  if (value.startsWith(RELAY_ERROR_PREFIX)) {
    try {
      return new Error(
        decodeURIComponent(value.slice(RELAY_ERROR_PREFIX.length)),
      );
    } catch {
      return new Error("中转服务返回了损坏的错误消息。");
    }
  }
  try {
    const data = JSON.parse(value) as Record<string, unknown>;
    return data.type === "relay_error" && typeof data.message === "string"
      ? new Error(data.message)
      : null;
  } catch {
    const detail = value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 180);
    return new Error(
      detail ? `中转服务收到纯文本：${detail}` : "中转服务返回了空文本消息。",
    );
  }
}

async function transcribeOnce(
  audioBase64: string,
  config: ProviderConfig,
): Promise<string> {
  const pcm = extractPcmFromWav(decodeBase64(audioBase64));
  if (pcm.byteLength === 0) throw new Error("刚才没有可识别的声音。");
  const audioLevel = measurePcmLevel(pcm);
  if (audioLevel.peak < 0.001) {
    throw new Error(
      `扩展捕获到的标签页音频接近静音（峰值 ${audioLevel.peak.toFixed(5)}）。请确认视频正在播放且标签页没有静音。`,
    );
  }

  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(relayWebSocketUrl(config.relayUrl), [
      RELAY_PROTOCOL,
      config.relayToken,
    ]);
    socket.binaryType = "arraybuffer";
    let latestTranscript = "";
    let lastPayload: unknown;
    let settled = false;
    let messageTail: Promise<void> = Promise.resolve();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else if (latestTranscript) resolve(latestTranscript);
      else
        reject(
          new Error(
            `豆包返回了空文本（音频峰值 ${audioLevel.peak.toFixed(3)}，RMS ${audioLevel.rms.toFixed(3)}；响应 ${summarizeDoubaoPayload(lastPayload)}）。`,
          ),
        );
    };
    const timeout = setTimeout(() => {
      socket.close();
      finish(new Error("豆包语音识别超时，请稍后重试。"));
    }, 20_000);

    socket.onopen = () => {
      void (async () => {
        socket.send(await makeDoubaoRequestPacket());
        const count = Math.ceil(pcm.byteLength / AUDIO_CHUNK_BYTES);
        for (let index = 0; index < count; index += 1) {
          const start = index * AUDIO_CHUNK_BYTES;
          const chunk = pcm.slice(start, start + AUDIO_CHUNK_BYTES);
          socket.send(await makeDoubaoAudioPacket(chunk, index === count - 1));
        }
      })().catch((error: unknown) => {
        socket.close();
        finish(
          error instanceof Error ? error : new Error("豆包请求数据生成失败。"),
        );
      });
    };
    socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (typeof event.data === "string") {
        const error = relayControlError(event.data);
        if (error) {
          socket.close();
          finish(error);
        }
        return;
      }
      const packet = event.data;
      messageTail = messageTail
        .then(async () => {
          const payload = await parseDoubaoPacket(packet);
          if (payload !== null) lastPayload = payload;
          const transcript = extractTranscript(payload);
          if (transcript) latestTranscript = transcript;
          if (nestedRecord(payload, "is_last_package") === true) {
            socket.close();
            finish();
          }
        })
        .catch((error: unknown) => {
          socket.close();
          finish(
            error instanceof Error
              ? error
              : new Error("豆包语音识别返回异常。"),
          );
        });
    };
    socket.onerror = () => {
      finish(
        new Error("无法连接 Cloudflare 中转，请检查 Worker 地址和连接口令。"),
      );
    };
    socket.onclose = (event: CloseEvent) => {
      void messageTail.then(() => {
        if (!settled && !latestTranscript && lastPayload === undefined) {
          finish(
            new Error(
              `中转连接已关闭（代码 ${event.code}${event.reason ? `，${event.reason}` : ""}）。`,
            ),
          );
        } else finish();
      });
    };
  });
}

let transcriptionTail: Promise<unknown> = Promise.resolve();

async function transcribe(
  audioBase64: string,
  config: ProviderConfig,
): Promise<string> {
  const cacheKey = transcriptCacheKey(
    config,
    await audioFingerprint(audioBase64),
  );
  const cached = readCache(transcriptCache, cacheKey);
  if (cached) return cached;
  const task = transcriptionTail.then(async () => {
    const queuedCacheHit = readCache(transcriptCache, cacheKey);
    if (queuedCacheHit) return queuedCacheHit;
    const transcript = await transcribeOnce(audioBase64, config);
    writeCache(transcriptCache, cacheKey, transcript);
    return transcript;
  });
  transcriptionTail = task.catch(() => undefined);
  return task;
}

export async function answerWithProviders(
  audioBase64: string,
  config: ProviderConfig,
  onTranscript?: (transcript: string) => void | Promise<void>,
): Promise<QuickAskAnswer> {
  const transcript = await transcribe(audioBase64, config);
  await onTranscript?.(transcript);
  const cacheKey = answerCacheKey(config, transcript);
  const cached = readCache(answerCache, cacheKey);
  if (cached) return cached;
  const response = await fetch(relayHttpUrl(config.relayUrl, "/v1/explain"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.relayToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });
  const decoded = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      decoded &&
      typeof decoded === "object" &&
      "message" in decoded &&
      typeof decoded.message === "string"
        ? decoded.message
        : "解释服务暂时不可用。";
    throw new Error(message);
  }
  const parsed = QuickAskAnswerSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("中转服务返回的解释格式无效。");
  writeCache(answerCache, cacheKey, parsed.data);
  return parsed.data;
}
