import { defineConfig } from "wxt";

const extensionKey = process.env.WXT_PUBLIC_EXTENSION_KEY?.trim();
const apiBaseUrl =
  process.env.WXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8787";

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const apiOrigin = originOf(apiBaseUrl);

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
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
    host_permissions: apiOrigin ? [`${apiOrigin}/*`] : [],
    action: { default_title: "点击开始监听最近 10 秒" },
    commands: {
      "quick-ask": {
        suggested_key: { default: "Alt+Q" },
        description: "解释刚才听到的英文",
      },
    },
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' ${apiOrigin ?? ""}`,
    },
    ...(extensionKey ? { key: extensionKey } : {}),
  },
});
