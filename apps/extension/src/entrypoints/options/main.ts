import {
  loadProviderConfig,
  saveProviderConfig,
} from "../../lib/direct-provider";
import "./styles.css";

const form = document.querySelector<HTMLFormElement>("#form")!;
const doubaoAppId = document.querySelector<HTMLInputElement>("#doubao-app-id")!;
const doubaoAccessToken = document.querySelector<HTMLInputElement>(
  "#doubao-access-token",
)!;
const deepseek = document.querySelector<HTMLInputElement>("#deepseek")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

void loadProviderConfig().then((config) => {
  if (!config) return;
  doubaoAppId.value = config.doubaoAppId;
  doubaoAccessToken.value = config.doubaoAccessToken;
  deepseek.value = config.deepseekApiKey;
  status.textContent = "已保存。修改后可再次保存。";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const appId = doubaoAppId.value.trim();
  const accessToken = doubaoAccessToken.value.trim();
  const deepseekApiKey = deepseek.value.trim();
  if (
    !/^\d+$/.test(appId) ||
    accessToken.length < 8 ||
    deepseekApiKey.length < 8
  ) {
    status.textContent =
      "请填写数字 APP ID、Access Token 和 DeepSeek API Key。";
    status.dataset.error = "true";
    return;
  }
  void saveProviderConfig({
    doubaoAppId: appId,
    doubaoAccessToken: accessToken,
    deepseekApiKey,
  }).then(() => {
    status.dataset.error = "false";
    status.textContent = "保存成功。现在回到视频，点击扩展图标开始监听。";
  });
});
