import {
  QuickAskAnswerSchema,
  WorkerErrorSchema,
} from "@contextlines/contracts";

const LISTENING_KEY = "quickAskListening";
const VIEW_STATE_KEY = "quickAskViewState";
const QUESTION_KEY = "quickAskQuestion";
const OFFSCREEN_PATH = "offscreen.html";

type ListeningState = { tabId: number; title?: string; origin?: string };
type QuestionState = { windowId: number; tabId: number; shouldResume: boolean };
type ClipResponse =
  | { ok: true; audioBase64: string; durationMs: number }
  | { ok: false; message: string };

async function getListening(): Promise<ListeningState | null> {
  return (
    ((await chrome.storage.session.get(LISTENING_KEY))[LISTENING_KEY] as
      ListeningState | undefined) ?? null
  );
}

async function ensureOffscreen(): Promise<void> {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification:
      "Keep the last few seconds of user-selected tab audio in memory for Alt+Q.",
  });
}

async function stopListening(): Promise<void> {
  const listening = await getListening();
  await chrome.runtime
    .sendMessage({ type: "audio:stop" })
    .catch(() => undefined);
  await chrome.storage.session.remove(LISTENING_KEY);
  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({ title: "点击开始监听最近 10 秒" });
  if (listening) {
    await chrome.action.setBadgeText({ tabId: listening.tabId, text: "" });
    await chrome.action.setTitle({
      tabId: listening.tabId,
      title: "点击开始监听最近 10 秒",
    });
  }
}

async function startListening(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url?.startsWith("http"))
    throw new Error("请在普通网页视频标签页中使用");
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tab.id,
  });
  const response = (await chrome.runtime.sendMessage({
    type: "audio:start",
    streamId,
    tabId: tab.id,
  })) as { ok: boolean; message?: string };
  if (!response.ok)
    throw new Error(response.message || "Chrome 未允许捕获当前标签页");
  const url = new URL(tab.url);
  await chrome.storage.session.set({
    [LISTENING_KEY]: {
      tabId: tab.id,
      ...(tab.title ? { title: tab.title.slice(0, 160) } : {}),
      origin: url.origin,
    } satisfies ListeningState,
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#2d8f5b" });
  await chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
  await chrome.action.setTitle({
    tabId: tab.id,
    title: "正在监听，按 Alt+Q 询问；点击停止",
  });
}

async function toggleListening(tab: chrome.tabs.Tab): Promise<void> {
  if (await getListening()) return stopListening();
  try {
    await startListening(tab);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法监听当前标签页";
    await chrome.action.setBadgeBackgroundColor({ color: "#b84a4a" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({ tabId: tab.id, title: message });
    console.error(error);
  }
}

async function setVideoPaused(tabId: number, pause: boolean): Promise<boolean> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (shouldPause: boolean) => {
      const videos = Array.from(document.querySelectorAll("video"));
      if (shouldPause) {
        const playing = videos.filter((video) => !video.paused && !video.ended);
        playing.forEach((video) => {
          video.dataset.contextlinesWasPlaying = "true";
          video.pause();
        });
        return playing.length > 0;
      }
      const resumable = videos.filter(
        (video) => video.dataset.contextlinesWasPlaying === "true",
      );
      resumable.forEach((video) => {
        delete video.dataset.contextlinesWasPlaying;
        void video.play();
      });
      return resumable.length > 0;
    },
    args: [pause],
  });
  return Boolean(result?.result);
}

async function callQuickAsk(
  listening: ListeningState,
  clip: Extract<ClipResponse, { ok: true }>,
) {
  if (import.meta.env.WXT_PUBLIC_USE_MOCKS === "true") {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return QuickAskAnswerSchema.parse({
      transcript: "I wouldn't read too much into it.",
      phrase: "read too much into it",
      meaning_zh: "别过度解读，别给这件事附加太多含义。",
      context_zh: "说话人是在降低某个信号的重要性，让对方别想得太多。",
      usage_zh: "常用于劝人不要根据一个动作、消息或细节做太多推断。",
    });
  }
  const baseUrl = import.meta.env.WXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("尚未配置问答服务地址");
  const response = await fetch(`${baseUrl}/v1/quick-ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(import.meta.env.WXT_PUBLIC_QUICK_ASK_ACCESS_TOKEN
        ? {
            Authorization: `Bearer ${import.meta.env.WXT_PUBLIC_QUICK_ASK_ACCESS_TOKEN}`,
          }
        : {}),
    },
    body: JSON.stringify({
      audio_base64: clip.audioBase64,
      mime_type: "audio/wav",
      duration_ms: clip.durationMs,
      ...(listening.title ? { page_title: listening.title } : {}),
      ...(listening.origin ? { page_origin: listening.origin } : {}),
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = WorkerErrorSchema.safeParse(payload);
    throw new Error(
      parsed.success ? parsed.data.message : "问答服务暂时不可用",
    );
  }
  return QuickAskAnswerSchema.parse(payload);
}

async function openAnswerWindow(
  tabId: number,
  shouldResume: boolean,
): Promise<void> {
  await chrome.storage.session.set({ [VIEW_STATE_KEY]: { status: "loading" } });
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("answer.html"),
    type: "popup",
    width: 430,
    height: 520,
    focused: true,
  });
  if (!created || created.id === undefined) throw new Error("无法打开解释窗口");
  await chrome.storage.session.set({
    [QUESTION_KEY]: {
      windowId: created.id,
      tabId,
      shouldResume,
    } satisfies QuestionState,
  });
}

async function askAboutRecentAudio(): Promise<void> {
  if ((await chrome.storage.session.get(QUESTION_KEY))[QUESTION_KEY]) return;
  const listening = await getListening();
  if (!listening) {
    const tabId = (
      await chrome.tabs.query({ active: true, currentWindow: true })
    )[0]?.id;
    if (!tabId) return;
    await openAnswerWindow(tabId, false);
    await chrome.storage.session.set({
      [VIEW_STATE_KEY]: {
        status: "error",
        message: "先点击扩展图标开始监听，再按 Alt+Q。",
      },
    });
    return;
  }
  let shouldResume = false;
  try {
    shouldResume = await setVideoPaused(listening.tabId, true);
  } catch {
    /* capture remains usable */
  }
  await openAnswerWindow(listening.tabId, shouldResume);
  try {
    const clip = (await chrome.runtime.sendMessage({
      type: "audio:get-clip",
    })) as ClipResponse;
    if (!clip.ok) throw new Error(clip.message);
    const answer = await callQuickAsk(listening, clip);
    await chrome.storage.session.set({
      [VIEW_STATE_KEY]: { status: "answer", answer },
    });
  } catch (error) {
    await chrome.storage.session.set({
      [VIEW_STATE_KEY]: {
        status: "error",
        message:
          error instanceof Error ? error.message : "没有成功识别刚才的声音",
      },
    });
  }
}

export default defineBackground(() => {
  chrome.action.onClicked.addListener((tab) => void toggleListening(tab));
  chrome.commands.onCommand.addListener((command) => {
    if (command === "quick-ask") void askAboutRecentAudio();
  });
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message.type === "audio:ended") void stopListening();
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    void chrome.storage.session.get(QUESTION_KEY).then(async (stored) => {
      const question = stored[QUESTION_KEY] as QuestionState | undefined;
      if (!question || question.windowId !== windowId) return;
      await chrome.storage.session.remove([QUESTION_KEY, VIEW_STATE_KEY]);
      if (question.shouldResume)
        await setVideoPaused(question.tabId, false).catch(() => undefined);
    });
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void getListening().then((state) => {
      if (state?.tabId === tabId) return stopListening();
    });
  });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url)
      void getListening().then((state) => {
        if (state?.tabId === tabId) return stopListening();
      });
  });
});
