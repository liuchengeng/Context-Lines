import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";

import { HttpError, type AppBindings } from "./http";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizedSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "认证服务配置无效。",
      false,
    );
  }
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "认证服务配置无效。",
      false,
    );
  }
  return url.origin;
}

function jwksFor(supabaseUrl: string) {
  const issuer = `${supabaseUrl}/auth/v1`;
  const cached = jwksByIssuer.get(issuer);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

export const requireAllowedUser: MiddlewareHandler<AppBindings> = async (
  context,
  next,
) => {
  const authorization = context.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTH_REQUIRED", "请先登录。", false);
  }

  const token = authorization.slice("Bearer ".length).trim();
  const supabaseUrl = normalizedSupabaseUrl(context.env.SUPABASE_URL);
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, jwksFor(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    }));
  } catch {
    throw new HttpError(
      401,
      "INVALID_SESSION",
      "登录已失效，请重新登录。",
      false,
    );
  }

  const email = typeof payload.email === "string" ? payload.email : "";
  const subject = payload.sub;
  if (!subject || !email) {
    throw new HttpError(
      401,
      "INVALID_SESSION",
      "登录信息不完整，请重新登录。",
      false,
    );
  }

  const allowedEmail = context.env.ALLOWED_EMAIL?.trim();
  if (!allowedEmail) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "允许邮箱尚未配置。",
      false,
    );
  }

  if (email.toLowerCase() !== allowedEmail.toLowerCase()) {
    throw new HttpError(
      403,
      "EMAIL_NOT_ALLOWED",
      "此 Google 邮箱不在 ContextLines 允许列表中。",
      false,
    );
  }

  context.set("user", { id: subject, email });
  await next();
};
