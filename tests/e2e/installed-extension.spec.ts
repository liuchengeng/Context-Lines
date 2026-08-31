import { chromium, expect, test } from "@playwright/test";
import { resolve } from "node:path";

test.skip(
  process.env.CONTEXTLINES_EXTENSION_E2E !== "1",
  "Set CONTEXTLINES_EXTENSION_E2E=1 for the installed-extension smoke test.",
);

test("installed Chrome exposes the ContextLines service worker", async () => {
  const extensionPath = resolve("apps/extension/.output/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker", { timeout: 10_000 });
    expect(worker.url()).toContain("chrome-extension://");
  } finally {
    await context.close();
  }
});
