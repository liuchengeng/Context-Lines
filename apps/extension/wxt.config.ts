import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "ContextLines Quick Ask",
    description: "Press Alt+Q to explain the English you just heard.",
    minimum_chrome_version: "116",
    permissions: [
      "activeTab",
      "declarativeNetRequestWithHostAccess",
      "offscreen",
      "scripting",
      "storage",
      "tabCapture",
    ],
    host_permissions: [
      "https://openspeech.bytedance.com/*",
      "https://api.deepseek.com/*",
    ],
    action: { default_title: "点击开始监听最近 10 秒" },
    commands: {
      "quick-ask": {
        suggested_key: { default: "Alt+Q" },
        description: "解释刚才听到的英文",
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' wss://openspeech.bytedance.com https://api.deepseek.com",
    },
  },
});
