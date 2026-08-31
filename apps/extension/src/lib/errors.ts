export type CaptureErrorCode =
  | "restricted-page"
  | "permission-denied"
  | "no-audio"
  | "not-signed-in"
  | "network"
  | "realtime"
  | "capture-unavailable"
  | "unknown";

export class CaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CaptureError";
  }
}

export function toCaptureError(error: unknown): CaptureError {
  if (error instanceof CaptureError) return error;
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return new CaptureError(
      "permission-denied",
      "Chrome 未允许捕获这个标签页。请回到普通网页后重试。",
      true,
    );
  }
  if (error instanceof Error) {
    return new CaptureError("unknown", error.message, true);
  }
  return new CaptureError("unknown", "发生未知错误。", true);
}
