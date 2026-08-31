import { defineConfig } from "wxt";

const extensionKey = process.env.WXT_PUBLIC_EXTENSION_KEY?.trim();

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
    action: {
      default_title: "Open ContextLines",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    ...(extensionKey ? { key: extensionKey } : {}),
  },
});
