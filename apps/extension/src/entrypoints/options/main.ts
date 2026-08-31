import {
  loadProviderConfig,
  saveProviderConfig,
} from "../../lib/direct-provider";
import "./styles.css";

const form = document.querySelector<HTMLFormElement>("#form")!;
const doubao = document.querySelector<HTMLInputElement>("#doubao")!;
const deepseek = document.querySelector<HTMLInputElement>("#deepseek")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

void loadProviderConfig().then((config) => {
  if (!config) return;
  doubao.value = config.doubaoApiKey;
  deepseek.value = config.deepseekApiKey;
  status.textContent = "已保存。修改后可再次保存。";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const doubaoApiKey = doubao.value.trim();
  const deepseekApiKey = deepseek.value.trim();
  if (doubaoApiKey.length < 8 || deepseekApiKey.length < 8) {
    status.textContent = "请填写完整的两个密钥。";
    status.dataset.error = "true";
    return;
  }
  void saveProviderConfig({ doubaoApiKey, deepseekApiKey }).then(() => {
    status.dataset.error = "false";
    status.textContent = "保存成功。现在回到视频，点击扩展图标开始监听。";
  });
});
