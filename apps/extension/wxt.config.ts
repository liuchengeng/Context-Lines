import { defineConfig } from "wxt";

const extensionKey = process.env.WXT_PUBLIC_EXTENSION_KEY?.trim();
const apiBaseUrl =
  process.env.WXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8787";
const supabaseUrl = process.env.WXT_PUBLIC_SUPABASE_URL?.trim();

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const allowedOrigins = [
  "https://api.openai.com",
  originOf(apiBaseUrl),
  originOf(supabaseUrl),
].filter((origin): origin is string => origin !== null);

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "ContextLines",
    description: "English context learning from user-selected tab audio.",
    minimum_chrome_version: "116",
    permissions: [
      "activeTab",
      "identity",
      "scripting",
      "sidePanel",
      "storage",
      "tabCapture",
    ],
    host_permissions: allowedOrigins.map((origin) => `${origin}/*`),
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' ${allowedOrigins.join(" ")}`,
    },
    action: {
      default_title: "Open ContextLines",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    ...(extensionKey ? { key: extensionKey } : {}),
  },
});
