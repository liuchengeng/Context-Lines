import type { ExtensionMessage } from "@contextlines/contracts";

import { CaptureError } from "./errors";

export interface SourceTab {
  id: number;
  title: string;
  origin: string;
}

export async function getActiveSourceTab(): Promise<SourceTab> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (!tab?.id || !tab.url) {
    throw new CaptureError(
      "capture-unavailable",
      "找不到可捕获的当前标签页。",
      true,
    );
  }

  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    throw new CaptureError(
      "restricted-page",
      "当前页面不是可捕获的普通网页。",
      false,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CaptureError(
      "restricted-page",
      "Chrome 内部页面、扩展商店和其他受限页面无法捕获。",
      false,
    );
  }

  if (
    url.hostname === "chromewebstore.google.com" ||
    (url.hostname === "chrome.google.com" &&
      url.pathname.startsWith("/webstore"))
  ) {
    throw new CaptureError(
      "restricted-page",
      "Chrome 应用商店禁止扩展捕获或注入字幕。请切换到普通网页。",
      false,
    );
  }

  return {
    id: tab.id,
    title: (tab.title || url.hostname).slice(0, 160),
    origin: url.origin,
  };
}

export async function captureActiveTabAudio(): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        const message = lastError.message ?? "Chrome 拒绝了标签页音频捕获。";
        reject(
          new CaptureError(
            /permission|invoked|activeTab/i.test(message)
              ? "permission-denied"
              : "capture-unavailable",
            /permission|invoked|activeTab/i.test(message)
              ? "Chrome 未允许捕获当前标签页。请重新点击扩展并重试。"
              : "Chrome 无法捕获当前标签页音频。请确认页面正在播放声音。",
            true,
          ),
        );
        return;
      }
      if (!stream) {
        reject(
          new CaptureError(
            "capture-unavailable",
            "Chrome 未返回标签页音频流。",
            true,
          ),
        );
        return;
      }
      resolve(stream);
    });
  });
}

export async function sendExtensionMessage(
  message: ExtensionMessage,
): Promise<void> {
  const response: unknown = await chrome.runtime.sendMessage(message);
  if (
    message.type === "capture:started" &&
    (!response ||
      typeof response !== "object" ||
      (response as { ok?: unknown }).ok !== true)
  ) {
    throw new CaptureError(
      "capture-unavailable",
      "Chrome 未能登记捕获生命周期，已安全停止。",
      true,
    );
  }
}

export async function getStoredAccessToken(): Promise<string | null> {
  const data = await chrome.storage.session.get("contextlines.access_token");
  const token = data["contextlines.access_token"];
  return typeof token === "string" && token.length > 0 ? token : null;
}
