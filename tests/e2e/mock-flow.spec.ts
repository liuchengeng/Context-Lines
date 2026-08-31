import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type CaptureBehavior = "ok" | "permission-denied" | "no-audio";

async function installChromeMocks(
  context: BrowserContext,
  behavior: CaptureBehavior = "ok",
) {
  await context.addInitScript((captureBehavior: CaptureBehavior) => {
    const sessionMemory: Record<string, unknown> = {};
    const localMemory: Record<string, unknown> = {};
    const storageArea = (memory: Record<string, unknown>) => ({
      async get(key: string) {
        return { [key]: memory[key] };
      },
      async set(values: Record<string, unknown>) {
        Object.assign(memory, values);
      },
      async remove(key: string) {
        delete memory[key];
      },
    });
    const runtime: Record<string, unknown> = {
      id: "contextlines-e2e",
      lastError: undefined,
      sendMessage: async (message: { type?: string }) =>
        message.type === "capture:started" ? { ok: true } : undefined,
      onMessage: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    };
    const mockedChrome = {
      runtime,
      tabs: {
        query: async () => [
          {
            id: 7,
            url: "https://example.test/watch",
            title: "Synthetic dialogue",
          },
        ],
      },
      tabCapture: {
        capture: (
          _options: unknown,
          callback: (stream: MediaStream | null) => void,
        ) => {
          if (captureBehavior === "permission-denied") {
            runtime.lastError = { message: "Permission denied" };
            callback(null);
            runtime.lastError = undefined;
            return;
          }
          if (captureBehavior === "no-audio") {
            callback(new MediaStream());
            return;
          }
          const audio = new AudioContext();
          const destination = audio.createMediaStreamDestination();
          Object.assign(globalThis, {
            __contextlinesE2eAudio: { audio, destination },
          });
          callback(destination.stream);
        },
      },
      storage: {
        session: storageArea(sessionMemory),
        local: storageArea(localMemory),
      },
      identity: {
        getRedirectURL: () =>
          "https://contextlines-e2e.chromiumapp.org/auth-callback",
      },
    };
    Object.assign(globalThis, {
      chrome: mockedChrome,
      __contextlinesE2eSessionStorage: sessionMemory,
      __contextlinesE2eLocalStorage: localMemory,
    });
  }, behavior);
}

async function openSidePanel(page: Page, context: BrowserContext) {
  await installChromeMocks(context);
  await page.goto("/sidepanel.html");
}

test("capture, analyze, save, and self-review without persisting a session transcript", async ({
  page,
  context,
}) => {
  await openSidePanel(page, context);
  await page.setViewportSize({ width: 400, height: 900 });

  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(
    page.getByText("I wouldn't read too much into it."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /I wouldn't read too much into/ })
    .click();
  await expect(page.getByRole("heading", { name: "自然中文" })).toBeVisible();

  await page
    .getByRole("button", {
      name: /read too much into it 对某件事作过度解读/,
    })
    .click();
  await page
    .getByLabel("我的例句")
    .fill("I read too much into it after our first meeting.");
  await page.getByRole("button", { name: "收藏并创建三张卡" }).click();
  await expect(page.getByText("已收藏，并创建 3 张复习卡。")).toBeVisible();

  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("3 张到期")).toBeVisible();
  await page.getByRole("button", { name: "揭示参考答案" }).click();
  await expect(
    page.getByText("I read too much into it after our first meeting."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Good" }).click();
  await expect(page.getByText("2 张到期")).toBeVisible();

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "停止识别" }).click();
  await expect(page.getByText("准备捕获当前网页音频")).toBeVisible();
  await expect(page.getByText("I wouldn't read too much into it.")).toHaveCount(
    0,
  );

  const privacyState = await page.evaluate(() => {
    const sessionValues = Object.assign(
      {},
      (globalThis as any).__contextlinesE2eSessionStorage,
    );
    const localValues = Object.assign(
      {},
      (globalThis as any).__contextlinesE2eLocalStorage,
    );
    const tracks = (
      globalThis as any
    ).__contextlinesE2eAudio.destination.stream.getTracks() as MediaStreamTrack[];
    return {
      serializedSessionStorage: JSON.stringify(sessionValues),
      serializedLocalStorage: JSON.stringify(localValues),
      tracksStopped: tracks.every((track) => track.readyState === "ended"),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
  expect(privacyState.serializedSessionStorage).not.toContain(
    "I wouldn't read too much into it.",
  );
  expect(privacyState.serializedLocalStorage).toBe("{}");
  expect(privacyState.tracksStopped).toBe(true);
  expect(privacyState.horizontalOverflow).toBe(false);
});

for (const scenario of ["permission-denied", "no-audio"] as const) {
  test(`shows a recoverable ${scenario} capture error`, async ({
    page,
    context,
  }) => {
    await installChromeMocks(context, scenario);
    await page.goto("/sidepanel.html");
    await page.getByRole("button", { name: "开始识别" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("准备捕获当前网页音频")).toBeVisible();
  });
}
