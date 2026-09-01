import {
  loadProviderConfig,
  normalizeRelayBaseUrl,
  saveProviderConfig,
} from "../../lib/direct-provider";
import { userFacingErrorMessage } from "../../lib/user-facing-error";
import "./styles.css";

const form = document.querySelector<HTMLFormElement>("#form")!;
const relayUrl = document.querySelector<HTMLInputElement>("#relay-url")!;
const relayToken = document.querySelector<HTMLInputElement>("#relay-token")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const button = document.querySelector<HTMLButtonElement>(
  "button[type=submit]",
)!;

void loadProviderConfig().then((config) => {
  if (!config) return;
  relayUrl.value = config.relayUrl;
  relayToken.value = config.relayToken;
  status.textContent = "已保存。修改后可再次检查。";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.dataset.error = "false";
  let baseUrl: string;
  try {
    baseUrl = normalizeRelayBaseUrl(relayUrl.value);
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Worker 地址无效。";
    status.dataset.error = "true";
    return;
  }
  const token = relayToken.value.trim();
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) {
    status.textContent =
      "连接口令应为 24 到 128 位随机字母、数字、下划线或横线。";
    status.dataset.error = "true";
    return;
  }

  button.disabled = true;
  status.textContent = "正在检查 Worker…";
  void fetch(`${baseUrl}/v1/config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `Worker 检查失败（HTTP ${response.status}）。`;
        throw new Error(message);
      }
      await saveProviderConfig({ relayUrl: baseUrl, relayToken: token });
      status.dataset.error = "false";
      status.textContent = "连接成功。现在回到视频，点击扩展图标开始监听。";
    })
    .catch((error: unknown) => {
      status.dataset.error = "true";
      status.textContent = userFacingErrorMessage(
        error,
        "无法连接 Worker，请稍后重试。",
      );
    })
    .finally(() => {
      button.disabled = false;
    });
});
