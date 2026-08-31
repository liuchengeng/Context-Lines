import {
  RealtimeClientSecretResponseSchema,
  WorkerErrorSchema,
  type RealtimeClientSecretResponse,
} from "@contextlines/contracts";

import { CaptureError } from "./errors";

interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}

export class ApiClient {
  readonly #baseUrl: string;
  readonly #getAccessToken: () => Promise<string | null>;
  readonly #fetcher: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#getAccessToken = options.getAccessToken;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async createRealtimeClientSecret(): Promise<RealtimeClientSecretResponse> {
    const accessToken = await this.#getAccessToken();
    if (!accessToken) {
      throw new CaptureError(
        "not-signed-in",
        "请先使用允许的 Google 邮箱登录。",
        false,
      );
    }

    let response: Response;
    try {
      response = await this.#fetcher(
        `${this.#baseUrl}/v1/realtime/client-secret`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
    } catch {
      throw new CaptureError(
        "network",
        "无法连接 ContextLines 服务。请检查网络后重试。",
        true,
      );
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = WorkerErrorSchema.safeParse(data);
      throw new CaptureError(
        response.status === 401 ? "not-signed-in" : "network",
        parsedError.success
          ? parsedError.data.message
          : "服务暂时无法签发识别凭证。",
        parsedError.success
          ? parsedError.data.retryable
          : response.status >= 500,
      );
    }

    const parsed = RealtimeClientSecretResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new CaptureError("network", "服务返回了无效的识别凭证。", true);
    }
    return parsed.data;
  }
}
