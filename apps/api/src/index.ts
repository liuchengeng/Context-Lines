import {
  CONTRACT_VERSION,
  DeepAnalysisRequestSchema,
  HealthResponseSchema,
  QuickAnalysisRequestSchema,
  WorkerErrorSchema,
} from "@contextlines/contracts";
import { Hono } from "hono";

import { requireAllowedUser } from "./auth";
import { OpenAIAnalysisProvider } from "./analysis-provider";
import { HttpError, type AppBindings, requestIdOf } from "./http";
import { createRealtimeClientSecret } from "./openai";

const app = new Hono<AppBindings>();

app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);

  const origin = context.req.header("Origin");
  const allowedExtensionId = context.env?.ALLOWED_EXTENSION_ID?.trim();
  const allowedOrigin = allowedExtensionId
    ? `chrome-extension://${allowedExtensionId}`
    : null;

  if (origin && origin !== allowedOrigin) {
    throw new HttpError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "请求来源不在允许列表中。",
      false,
    );
  }

  if (context.req.method === "OPTIONS") {
    if (!allowedOrigin) {
      throw new HttpError(
        500,
        "SERVER_MISCONFIGURED",
        "扩展来源尚未配置。",
        false,
      );
    }
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
  const payload = WorkerErrorSchema.parse({
    code: httpError.code,
    message: httpError.message,
    request_id: requestId,
    retryable: httpError.retryable,
  });
  return context.json(payload, httpError.status, {
    "X-Request-Id": requestId,
  });
});

app.get("/health", (context) => {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    version: CONTRACT_VERSION,
  });

  return context.json(payload);
});

app.use("/v1/*", requireAllowedUser);

app.post("/v1/realtime/client-secret", async (context) => {
  const user = context.get("user");
  const payload = await createRealtimeClientSecret(
    context.env,
    user.id,
    requestIdOf(context),
  );
  return context.json(payload);
});

app.post("/v1/analysis/quick", async (context) => {
  const rawBody: unknown = await context.req.json().catch(() => {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "请求正文必须是有效 JSON。",
      false,
    );
  });
  const parsed = QuickAnalysisRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "INVALID_REQUEST",
      "分析上下文不符合数据契约。",
      false,
    );
  }
  const provider = new OpenAIAnalysisProvider(
    context.env,
    context.get("user").id,
    requestIdOf(context),
  );
  return context.json(await provider.quick(parsed.data.context));
});

app.post("/v1/analysis/deep", async (context) => {
  const rawBody: unknown = await context.req.json().catch(() => {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "请求正文必须是有效 JSON。",
      false,
    );
  });
  const parsed = DeepAnalysisRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "INVALID_REQUEST",
      "深入分析请求不符合数据契约。",
      false,
    );
  }
  const provider = new OpenAIAnalysisProvider(
    context.env,
    context.get("user").id,
    requestIdOf(context),
  );
  return context.json(
    await provider.deep(parsed.data.context, parsed.data.quick),
  );
});

export default app;
