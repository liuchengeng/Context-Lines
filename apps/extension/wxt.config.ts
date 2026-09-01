import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "ContextLines Quick Ask",
    description: "Press Alt+Q to explain the English you just heard.",
    minimum_chrome_version: "116",
    permissions: [
      "activeTab",
      "offscreen",
      "scripting",
      "storage",
      "tabCapture",
    ],
    host_permissions: [
      "https://*.workers.dev/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ],
    action: { default_title: "点击开始监听最近声音" },
    commands: {
      "quick-ask": {
        suggested_key: { default: "Alt+Q" },
        description: "解释刚才听到的英文",
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' https://*.workers.dev wss://*.workers.dev http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
    },
  },
});
