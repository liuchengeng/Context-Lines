import type { QuickAskAnswer } from "@contextlines/contracts";
import {
  answerWithProviders,
  loadProviderConfig,
} from "../lib/direct-provider";

const LISTENING_KEY = "quickAskListening";
const OFFSCREEN_PATH = "offscreen.html";

type ListeningState = { tabId: number; title?: string; origin?: string };
type ClipResponse =
  | { ok: true; audioBase64: string; durationMs: number }
  | { ok: false; message: string };
type OverlayView =
  | { status: "toggle" }
  | { status: "loading"; pauseVideo: boolean }
  | { status: "error"; message: string }
  | { status: "answer"; answer: QuickAskAnswer };

let activeRequestId = 0;

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
  activeRequestId += 1;
  if (listening) {
    await updateOverlay(
      listening.tabId,
      { status: "toggle" },
      activeRequestId,
    ).catch(() => undefined);
  }
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
  if (!(await loadProviderConfig())) {
    await chrome.action.setBadgeBackgroundColor({ color: "#8a6d32" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "?" });
    await chrome.runtime.openOptionsPage();
    return;
  }
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

async function updateOverlay(
  tabId: number,
  view: OverlayView,
  requestId: number,
): Promise<boolean> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (nextView: OverlayView, nextRequestId: number) => {
      type QuickAskHost = HTMLDivElement & {
        contextLinesPausedVideo?: HTMLVideoElement;
        contextLinesShouldResume?: boolean;
      };
      const hostId = "contextlines-quick-ask";
      const existing = document.getElementById(hostId) as QuickAskHost | null;
      const resumeAndRemove = (element: QuickAskHost | null) => {
        if (!element) return;
        const video = element.contextLinesPausedVideo;
        if (element.contextLinesShouldResume && video?.paused && !video.ended) {
          void video.play().catch(() => undefined);
        }
        element.remove();
      };
      if (nextView.status === "toggle") {
        resumeAndRemove(existing);
        return Boolean(existing);
      }

      if (
        nextView.status !== "loading" &&
        (!existing || existing.dataset.requestId !== String(nextRequestId))
      ) {
        return false;
      }

      const host = existing ?? (document.createElement("div") as QuickAskHost);
      host.id = hostId;
      host.dataset.requestId = String(nextRequestId);
      if (!existing && nextView.status === "loading" && nextView.pauseVideo) {
        const visibleVideos = Array.from(document.querySelectorAll("video"))
          .filter((video) => {
            const rect = video.getBoundingClientRect();
            const style = getComputedStyle(video);
            return (
              rect.width >= 120 &&
              rect.height >= 80 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            return (
              rightRect.width * rightRect.height -
              leftRect.width * leftRect.height
            );
          });
        const video = visibleVideos[0];
        if (video) {
          const totalSeconds = Math.max(0, Math.floor(video.currentTime));
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          host.dataset.pauseTime = hours
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            : `${minutes}:${String(seconds).padStart(2, "0")}`;
          host.contextLinesPausedVideo = video;
          host.contextLinesShouldResume = !video.paused && !video.ended;
          if (host.contextLinesShouldResume) video.pause();
        }
      }
      Object.assign(host.style, {
        all: "initial",
        position: "fixed",
        zIndex: "2147483647",
        top: "16px",
        right: "16px",
        width: "min(360px, calc(100vw - 32px))",
        pointerEvents: "auto",
      });
      if (!host.shadowRoot) host.attachShadow({ mode: "open" });
      const shadow = host.shadowRoot;
      if (!shadow) return false;
      shadow.replaceChildren();

      const style = document.createElement("style");
      style.textContent = `
        :host { color-scheme: dark; }
        * { box-sizing: border-box; }
        .card { position: relative; max-height: 52vh; overflow: auto; padding: 14px 40px 14px 15px; border: 1px solid rgba(255,255,255,.17); border-radius: 10px; background: rgba(9,10,12,.97); color: #f5f5f5; box-shadow: 0 8px 28px rgba(0,0,0,.38); font: 13px/1.55 Inter,"Segoe UI",system-ui,sans-serif; backdrop-filter: blur(10px); }
        .close { position: absolute; top: 7px; right: 7px; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #9b9da2; font: 20px/1 system-ui; cursor: pointer; }
        .close:hover { background: #26282c; color: #fff; }
        .label { margin: 12px 0 4px; color: #8f9297; font-size: 11px; font-weight: 650; letter-spacing: .02em; }
        .label:first-of-type { margin-top: 0; }
        .paused { margin: 0 0 9px; color: #e2bd72; font-size: 11px; }
        p { margin: 0; color: #d5d6d8; }
        .sentence { color: #f3f4f6; font-size: 17px; font-weight: 600; line-height: 1.5; }
        .highlight { padding: 1px 2px; border-radius: 3px; font-weight: 760; }
        .tone-0 { color: #9bc1ff; }
        .tone-1 { color: #d7adff; }
        .tone-2 { color: #ffc27a; }
        mark.tone-0 { background: rgba(93,145,236,.19); }
        mark.tone-1 { background: rgba(168,102,225,.18); }
        mark.tone-2 { background: rgba(232,145,63,.18); }
        .explanations { margin-top: 2px; }
        .explanation { display: grid; grid-template-columns: minmax(0,max-content) minmax(0,1fr); gap: 8px; align-items: baseline; padding: 7px 0; border-top: 1px solid #292b2e; }
        .explanation:first-child { border-top: 0; }
        .selected-phrase { font-weight: 720; }
        .brief-meaning { color: #d5d6d8; }
        .loading { display: flex; align-items: center; min-height: 32px; color: #c8c9cc; }
        .dot { width: 7px; height: 7px; margin-right: 9px; border-radius: 50%; background: #8bb8ff; animation: pulse .8s ease-in-out infinite alternate; }
        .error { color: #ffb1b1; }
        .resume { width: 100%; height: 34px; margin-top: 13px; border: 1px solid #8bb8ff; border-radius: 7px; background: #8bb8ff; color: #07101f; font: 650 12px/1 Inter,"Segoe UI",system-ui,sans-serif; cursor: pointer; }
        .resume:hover { background: #a6c9ff; }
        .hint { margin-top: 7px; color: #74777c; font-size: 10px; text-align: center; }
        @keyframes pulse { to { opacity: .25; } }
      `;
      const card = document.createElement("section");
      card.className = "card";
      const close = document.createElement("button");
      close.className = "close";
      close.type = "button";
      close.ariaLabel = "关闭解释";
      close.textContent = "×";
      close.addEventListener("click", () => resumeAndRemove(host));
      card.append(close);

      const addText = (tag: "p" | "h2", text: string, className?: string) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        card.append(element);
      };
      const appendHighlightedTranscript = (
        container: HTMLElement,
        transcript: string,
        explanations: QuickAskAnswer["explanations"],
      ) => {
        const lowerTranscript = transcript.toLocaleLowerCase();
        const matches: Array<{ start: number; end: number; tone: number }> = [];
        explanations.forEach((explanation, tone) => {
          const phrase = explanation.phrase.trim().toLocaleLowerCase();
          if (!phrase) return;
          let cursor = 0;
          while (cursor < lowerTranscript.length) {
            const start = lowerTranscript.indexOf(phrase, cursor);
            if (start < 0) return;
            const end = start + phrase.length;
            const overlaps = matches.some(
              (match) => start < match.end && end > match.start,
            );
            if (!overlaps) {
              matches.push({ start, end, tone });
              return;
            }
            cursor = start + 1;
          }
        });
        matches.sort((left, right) => left.start - right.start);
        let cursor = 0;
        for (const match of matches) {
          if (match.start > cursor) {
            container.append(transcript.slice(cursor, match.start));
          }
          const mark = document.createElement("mark");
          mark.className = `highlight tone-${match.tone}`;
          mark.textContent = transcript.slice(match.start, match.end);
          container.append(mark);
          cursor = match.end;
        }
        if (cursor < transcript.length)
          container.append(transcript.slice(cursor));
      };
      if (host.dataset.pauseTime) {
        addText(
          "p",
          `已暂停在 ${host.dataset.pauseTime} · 关闭后继续播放`,
          "paused",
        );
      }
      if (nextView.status === "loading") {
        const loading = document.createElement("div");
        loading.className = "loading";
        const dot = document.createElement("span");
        dot.className = "dot";
        loading.append(dot, "正在识别刚才约 10 秒，并挑出需要解释的表达…");
        card.append(loading);
      } else if (nextView.status === "error") {
        addText("p", "处理没有完成", "label");
        addText("p", nextView.message, "error");
      } else {
        addText("p", "识别到的完整英文", "label");
        const sentence = document.createElement("p");
        sentence.className = "sentence";
        appendHighlightedTranscript(
          sentence,
          nextView.answer.transcript,
          nextView.answer.explanations,
        );
        card.append(sentence);

        addText("p", "选出的表达", "label");
        const explanations = document.createElement("div");
        explanations.className = "explanations";
        nextView.answer.explanations.forEach((explanation, tone) => {
          const row = document.createElement("div");
          row.className = "explanation";
          const phrase = document.createElement("span");
          phrase.className = `selected-phrase tone-${tone}`;
          phrase.textContent = explanation.phrase;
          const meaning = document.createElement("span");
          meaning.className = "brief-meaning";
          meaning.textContent = `→ ${explanation.meaning_zh}`;
          row.append(phrase, meaning);
          explanations.append(row);
        });
        card.append(explanations);
      }
      if (nextView.status !== "loading") {
        const resume = document.createElement("button");
        resume.className = "resume";
        resume.type = "button";
        resume.textContent = host.contextLinesShouldResume
          ? "关闭并继续播放"
          : "关闭";
        resume.addEventListener("click", () => resumeAndRemove(host));
        card.append(resume);
        addText("p", "也可以再按一次 Alt+Q", "hint");
      }
      shadow.append(style, card);
      const container = document.fullscreenElement ?? document.documentElement;
      if (host.parentElement !== container) container.append(host);
      return true;
    },
    args: [view, requestId],
  });
  return Boolean(result?.result);
}

async function callQuickAsk(
  listening: ListeningState,
  clip: Extract<ClipResponse, { ok: true }>,
) {
  const config = await loadProviderConfig();
  if (!config) throw new Error("请先点击扩展图标填写 Worker 地址和连接口令。");
  return answerWithProviders(clip.audioBase64, config, listening.title);
}

async function askAboutRecentAudio(): Promise<void> {
  const listening = await getListening();
  const tabId =
    listening?.tabId ??
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (!tabId) return;

  if (await updateOverlay(tabId, { status: "toggle" }, activeRequestId)) {
    activeRequestId += 1;
    return;
  }

  const requestId = ++activeRequestId;
  if (!listening) {
    await updateOverlay(
      tabId,
      { status: "loading", pauseVideo: false },
      requestId,
    );
    await updateOverlay(
      tabId,
      { status: "error", message: "先点击扩展图标开始监听，再按 Alt+Q。" },
      requestId,
    );
    return;
  }
  await updateOverlay(
    tabId,
    { status: "loading", pauseVideo: true },
    requestId,
  );
  try {
    const clip = (await chrome.runtime.sendMessage({
      type: "audio:get-clip",
    })) as ClipResponse;
    if (!clip.ok) throw new Error(clip.message);
    const answer = await callQuickAsk(listening, clip);
    if (requestId === activeRequestId) {
      await updateOverlay(tabId, { status: "answer", answer }, requestId);
    }
  } catch (error) {
    if (requestId === activeRequestId) {
      await updateOverlay(
        tabId,
        {
          status: "error",
          message:
            error instanceof Error ? error.message : "没有成功识别刚才的声音",
        },
        requestId,
      );
    }
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
