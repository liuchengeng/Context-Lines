import {
  CONTRACT_VERSION,
  HealthResponseSchema,
  QuickAskRequestSchema,
  WorkerErrorSchema,
} from "@contextlines/contracts";
import { Hono } from "hono";
import { HttpError, type AppBindings, requestIdOf } from "./http";
import { answerQuickAsk } from "./quick-ask-provider";

const app = new Hono<AppBindings>();

app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  const origin = context.req.header("Origin");
  const extensionId = context.env?.ALLOWED_EXTENSION_ID?.trim();
  const allowedOrigin = extensionId
    ? `chrome-extension://${extensionId}`
    : null;
  if (origin && origin !== allowedOrigin)
    throw new HttpError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "请求来源不在允许列表中。",
      false,
    );
  if (context.req.method === "OPTIONS") {
    if (!allowedOrigin)
      throw new HttpError(
        500,
        "SERVER_MISCONFIGURED",
        "扩展来源尚未配置。",
        false,
      );
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
        "X-Request-Id": requestId,
      },
    });
  }
  await next();
  context.header("X-Request-Id", requestId);
  if (origin && allowedOrigin) {
    context.header("Access-Control-Allow-Origin", allowedOrigin);
    context.header("Vary", "Origin");
  }
});

app.onError((error, context) => {
  const requestId = requestIdOf(context);
  const httpError =
    error instanceof HttpError
      ? error
      : new HttpError(500, "INTERNAL_ERROR", "服务发生内部错误。", true);
  return context.json(
    WorkerErrorSchema.parse({
      code: httpError.code,
      message: httpError.message,
      request_id: requestId,
      retryable: httpError.retryable,
    }),
    httpError.status,
    { "X-Request-Id": requestId },
  );
});

app.get("/health", (context) =>
  context.json(
    HealthResponseSchema.parse({ status: "ok", version: CONTRACT_VERSION }),
  ),
);

app.post("/v1/quick-ask", async (context) => {
  const expectedToken = context.env.QUICK_ASK_ACCESS_TOKEN?.trim();
  const suppliedToken = context.req
    .header("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!expectedToken)
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "访问令牌尚未配置。",
      false,
    );
  if (!suppliedToken || suppliedToken !== expectedToken)
    throw new HttpError(401, "AUTH_REQUIRED", "问答服务访问令牌无效。", false);
  const raw: unknown = await context.req.json().catch(() => {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "请求正文必须是有效 JSON。",
      false,
    );
  });
  const parsed = QuickAskRequestSchema.safeParse(raw);
  if (!parsed.success)
    throw new HttpError(
      422,
      "INVALID_REQUEST",
      "音频片段不符合数据契约。",
      false,
    );
  return context.json(await answerQuickAsk(context.env, parsed.data));
});

export default app;
