const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed/i;

export function userFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;
  if (NETWORK_ERROR_PATTERN.test(message)) {
    return "网络连接失败，请检查网络和 Worker 地址后重试。";
  }
  return message;
}
