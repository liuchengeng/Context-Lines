import { QuickAskAnswerSchema } from "@contextlines/contracts";
import { z } from "zod";

const DOUBAO_URL =
  "https://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
export const DOUBAO_RESOURCE_ID = "volc.seedasr.sauc.duration";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const RELAY_PROTOCOL = "contextlines";
const RELAY_ERROR_PREFIX = "contextlines-error:";
const MAX_QUEUED_BYTES = 1024 * 1024;

export interface Env {
  DOUBAO_APP_ID: string;
  DOUBAO_ACCESS_TOKEN: string;
  DEEPSEEK_API_KEY: string;
  RELAY_TOKEN: string;
}

const ExplainInputSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  page_title: z.string().trim().max(160).default(""),
});

const DeepSeekResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

function isExtensionOrigin(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "chrome-extension:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  return origin && isExtensionOrigin(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        Vary: "Origin",
      }
    : {};
}

function json(request: Request, value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
  retryable = false,
): Response {
  return json(
    request,
    { code, message, request_id: crypto.randomUUID(), retryable },
    status,
  );
}

function hasBearerToken(request: Request, env: Env): boolean {
  return (
    isValidRelayToken(env.RELAY_TOKEN) &&
    request.headers.get("Authorization") === `Bearer ${env.RELAY_TOKEN}`
  );
}

function isValidRelayToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{24,128}$/.test(value);
}

export function parseRelaySubprotocol(
  header: string | null,
  expectedToken: string,
): boolean {
  const protocols = (header ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    protocols.includes(RELAY_PROTOCOL) && protocols.includes(expectedToken)
  );
}

function safeHeader(value: string | null): string {
  return (value ?? "").replace(/[\r\n]/g, " ").slice(0, 160);
}

function sendRelayError(socket: WebSocket, message: string): void {
  if (socket.readyState !== 1) return;
  socket.send(`${RELAY_ERROR_PREFIX}${encodeURIComponent(message)}`);
}

function closeSocket(
  socket: WebSocket,
  code = 1011,
  reason = "relay error",
): void {
  if (socket.readyState >= 2) return;
  try {
    socket.close(code, reason.slice(0, 120));
  } catch {
    socket.close();
  }
}

async function connectDoubao(clientSocket: WebSocket, env: Env): Promise<void> {
  let upstream: WebSocket | null = null;
  let clientClosed = false;
  let queuedBytes = 0;
  const queued: Array<string | ArrayBuffer> = [];
  const controller = new AbortController();

  clientSocket.addEventListener("message", (event) => {
    const data = event.data;
    if (upstream?.readyState === 1) {
      upstream.send(data);
      return;
    }
    const size = typeof data === "string" ? data.length : data.byteLength;
    queuedBytes += size;
    if (queuedBytes > MAX_QUEUED_BYTES) {
      sendRelayError(clientSocket, "待转发的音频过大，请缩短后重试。");
      closeSocket(clientSocket, 1009, "audio queue too large");
      controller.abort();
      return;
    }
    queued.push(data);
  });
  clientSocket.addEventListener("close", () => {
    clientClosed = true;
    controller.abort();
    if (upstream) closeSocket(upstream, 1000, "client closed");
  });
  clientSocket.addEventListener("error", () => {
    controller.abort();
    if (upstream) closeSocket(upstream);
  });

  try {
    const response = await fetch(DOUBAO_URL, {
      headers: {
        Upgrade: "websocket",
        "X-Api-App-Key": env.DOUBAO_APP_ID,
        "X-Api-Access-Key": env.DOUBAO_ACCESS_TOKEN,
        "X-Api-Resource-Id": DOUBAO_RESOURCE_ID,
        "X-Api-Connect-Id": crypto.randomUUID(),
      },
      signal: controller.signal,
    });
    if (!response.webSocket) {
      const apiStatus = safeHeader(response.headers.get("X-Api-Status-Code"));
      const apiMessage = safeHeader(response.headers.get("X-Api-Message"));
      const logId = safeHeader(response.headers.get("X-Tt-Logid"));
      const detail = [
        `HTTP ${response.status}`,
        apiStatus && `状态 ${apiStatus}`,
        apiMessage,
        logId && `LogID ${logId}`,
      ]
        .filter(Boolean)
        .join("；");
      throw new Error(`豆包鉴权或服务连接失败（${detail}）。`);
    }

    upstream = response.webSocket;
    upstream.addEventListener("message", (event) => {
      if (clientSocket.readyState !== 1) return;
      if (typeof event.data === "string") {
        const detail = safeHeader(event.data) || "空文本消息";
        sendRelayError(clientSocket, `豆包返回文本错误：${detail}`);
        closeSocket(clientSocket);
        closeSocket(upstream!);
        return;
      }
      clientSocket.send(event.data);
    });
    upstream.addEventListener("close", (event) => {
      if (clientSocket.readyState < 2) {
        closeSocket(
          clientSocket,
          event.code === 1000 ? 1000 : 1011,
          safeHeader(event.reason) || "Doubao closed",
        );
      }
    });
    upstream.addEventListener("error", () => {
      sendRelayError(clientSocket, "豆包连接发生网络错误，请稍后重试。");
      closeSocket(clientSocket);
    });
    upstream.accept({ allowHalfOpen: true });
    if (clientClosed) {
      closeSocket(upstream, 1000, "client closed");
      return;
    }
    for (const message of queued) upstream.send(message);
    queued.length = 0;
  } catch (error) {
    if (clientClosed) return;
    const message =
      error instanceof Error && error.name !== "AbortError"
        ? error.message
        : "豆包中转连接失败，请稍后重试。";
    sendRelayError(clientSocket, message);
    closeSocket(clientSocket);
  }
}

function handleDoubaoWebSocket(
  request: Request,
  env: Env,
  context: ExecutionContext,
): Response {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return errorResponse(
      request,
      426,
      "upgrade_required",
      "需要 WebSocket 连接。",
    );
  }
  if (!isExtensionOrigin(request.headers.get("Origin"))) {
    return errorResponse(request, 403, "origin_denied", "不允许此请求来源。");
  }
  if (
    !isValidRelayToken(env.RELAY_TOKEN) ||
    !parseRelaySubprotocol(
      request.headers.get("Sec-WebSocket-Protocol"),
      env.RELAY_TOKEN,
    )
  ) {
    return errorResponse(request, 401, "unauthorized", "连接口令无效。");
  }

  const pair = new WebSocketPair();
  const browser = pair[0]!;
  const worker = pair[1]!;
  worker.accept({ allowHalfOpen: true });
  context.waitUntil(connectDoubao(worker, env));
  return new Response(null, {
    status: 101,
    headers: { "Sec-WebSocket-Protocol": RELAY_PROTOCOL },
    webSocket: browser,
  });
}

async function handleExplain(request: Request, env: Env): Promise<Response> {
  let input: z.infer<typeof ExplainInputSchema>;
  try {
    input = ExplainInputSchema.parse(await request.json());
  } catch {
    return errorResponse(request, 400, "invalid_request", "解释请求内容无效。");
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
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
            content: JSON.stringify({
              transcript: input.transcript,
              page_title: input.page_title,
            }),
          },
        ],
      }),
    });
  } catch {
    return errorResponse(
      request,
      502,
      "deepseek_network_error",
      "DeepSeek 网络连接失败，请稍后重试。",
      true,
    );
  }
  if (!response.ok) {
    return errorResponse(
      request,
      response.status === 401 ? 502 : 503,
      "deepseek_error",
      response.status === 401
        ? "Cloudflare 中配置的 DeepSeek API Key 无效。"
        : "DeepSeek 解释服务暂时不可用。",
      response.status === 429 || response.status >= 500,
    );
  }

  const upstream = DeepSeekResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  const content = upstream.success
    ? upstream.data.choices[0]?.message.content
    : null;
  if (!content) {
    return errorResponse(
      request,
      502,
      "invalid_deepseek_response",
      "DeepSeek 没有返回有效解释。",
      true,
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    return errorResponse(
      request,
      502,
      "invalid_deepseek_response",
      "DeepSeek 返回的解释格式无效。",
      true,
    );
  }
  const answer = QuickAskAnswerSchema.safeParse(decoded);
  if (!answer.success) {
    return errorResponse(
      request,
      502,
      "invalid_deepseek_response",
      "DeepSeek 返回的解释缺少必要内容。",
      true,
    );
  }
  return json(request, answer.data);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return isExtensionOrigin(request.headers.get("Origin"))
        ? new Response(null, { status: 204, headers: corsHeaders(request) })
        : errorResponse(request, 403, "origin_denied", "不允许此请求来源。");
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json(request, {
        ok: true,
        service: "contextlines-relay",
        version: "0.1.0",
      });
    }
    if (url.pathname === "/v1/doubao") {
      return handleDoubaoWebSocket(request, env, context);
    }
    if (!isExtensionOrigin(request.headers.get("Origin"))) {
      return errorResponse(request, 403, "origin_denied", "不允许此请求来源。");
    }
    if (!hasBearerToken(request, env)) {
      return errorResponse(request, 401, "unauthorized", "连接口令无效。");
    }
    if (request.method === "GET" && url.pathname === "/v1/config") {
      const configured = Boolean(
        env.DOUBAO_APP_ID &&
        env.DOUBAO_ACCESS_TOKEN &&
        env.DEEPSEEK_API_KEY &&
        env.RELAY_TOKEN,
      );
      return configured
        ? json(request, { ok: true })
        : errorResponse(
            request,
            503,
            "missing_secrets",
            "Worker 尚未完整配置四个 Secrets。",
          );
    }
    if (request.method === "POST" && url.pathname === "/v1/explain") {
      return handleExplain(request, env);
    }
    return errorResponse(request, 404, "not_found", "接口不存在。");
  },
} satisfies ExportedHandler<Env>;
