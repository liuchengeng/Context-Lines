import type { Context } from "hono";

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user: AuthenticatedUser;
  };
};

export function requestIdOf(context: Context<AppBindings>): string {
  return context.get("requestId") || crypto.randomUUID();
}
