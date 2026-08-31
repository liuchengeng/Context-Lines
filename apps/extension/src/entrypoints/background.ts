import {
  ExtensionMessageSchema,
  type ExtensionMessage,
  type TranscriptLine,
} from "@contextlines/contracts";

import { CaptureRegistry } from "../lib/capture-registry";

function renderSubtitleOverlay(lines: TranscriptLine[]): void {
  const hostId = "contextlines-caption-host";
  const existing = document.getElementById(hostId);
  if (lines.length === 0) {
    existing?.remove();
    return;
  }

  const host = existing ?? document.createElement("div");
  host.id = hostId;
  if (!existing) {
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.left = "50%";
    host.style.bottom = "8vh";
    host.style.width = "min(760px, calc(100vw - 32px))";
    host.style.transform = "translateX(-50%)";
    host.style.pointerEvents = "none";
    document.documentElement.append(host);
    host.attachShadow({ mode: "open" });
  }

  const shadow = host.shadowRoot;
  if (!shadow) return;
  shadow.replaceChildren();

  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme: dark; }
    .wrap {
      display: grid;
      gap: 4px;
      padding: 10px 14px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: rgba(7,8,10,.92);
      color: #f4f4f6;
      font: 500 17px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
      font-feature-settings: "calt", "kern", "liga", "ss03";
      text-align: center;
      text-wrap: balance;
      backdrop-filter: blur(8px);
    }
    .line { margin: 0; }
    .partial { color: #9c9c9d; font-weight: 400; }
  `;
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  for (const line of lines) {
    const paragraph = document.createElement("p");
    paragraph.className = `line ${line.status === "partial" ? "partial" : "final"}`;
    paragraph.textContent = line.text;
    wrap.append(paragraph);
  }
  shadow.append(style, wrap);
}

async function executeOverlay(tabId: number, lines: TranscriptLine[]) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: renderSubtitleOverlay,
    args: [lines],
  });
}

export default defineBackground(() => {
  const captureRegistry = new CaptureRegistry(chrome.storage.session);

  void browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error: unknown) => {
      console.error("Failed to configure the ContextLines side panel", error);
    });

  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId === undefined) return;
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
      console.error("Failed to open the ContextLines side panel", error);
    });
  });

  const requestStop = async (
    reason: Extract<
      ExtensionMessage,
      { type: "capture:stop-requested" }
    >["reason"],
    tabId: number,
  ) => {
    const activeCapture = await captureRegistry.markStopRequested(tabId);
    if (!activeCapture) return;
    try {
      await chrome.runtime.sendMessage({
        type: "capture:stop-requested",
        reason,
      });
    } catch {
      await captureRegistry.clear(tabId).catch(() => undefined);
    }
  };

  chrome.runtime.onMessage.addListener(
    (rawMessage: unknown, _sender, sendResponse) => {
      const parsed = ExtensionMessageSchema.safeParse(rawMessage);
      if (!parsed.success) return;
      const message = parsed.data;

      if (message.type === "capture:started") {
        void captureRegistry.start(message.tab_id).then(
          () => sendResponse({ ok: true }),
          () => sendResponse({ ok: false }),
        );
        return true;
      }

      if (message.type === "capture:stopped") {
        void captureRegistry.clear(message.tab_id).then(
          () => sendResponse({ ok: true }),
          () => sendResponse({ ok: false }),
        );
        void executeOverlay(message.tab_id, []).catch(() => undefined);
        return true;
      }

      if (message.type === "overlay:update") {
        void executeOverlay(message.tab_id, message.lines).catch(
          () => undefined,
        );
        return;
      }

      if (message.type === "overlay:clear") {
        void executeOverlay(message.tab_id, []).catch(() => undefined);
      }
      return;
    },
  );

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void captureRegistry.get().then((activeCapture) => {
      if (activeCapture && activeCapture.tabId !== tabId) {
        return requestStop("active-tab-changed", activeCapture.tabId);
      }
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url !== undefined || changeInfo.status === "loading") {
      void captureRegistry.get().then((activeCapture) => {
        if (activeCapture?.tabId === tabId) {
          return requestStop("source-navigation", tabId);
        }
      });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void captureRegistry.get().then((activeCapture) => {
      if (activeCapture?.tabId === tabId) {
        return requestStop("source-tab-closed", tabId);
      }
    });
  });
});
