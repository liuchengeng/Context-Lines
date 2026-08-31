import { ExtensionMessageSchema } from "@contextlines/contracts";
import { useEffect, useMemo, useState } from "react";

import { ApiClient } from "../../lib/api-client";
import {
  CaptureController,
  type CaptureState,
} from "../../lib/capture-controller";
import {
  captureActiveTabAudio,
  getActiveSourceTab,
  getStoredAccessToken,
  sendExtensionMessage,
} from "../../lib/chrome-capture";
import {
  MockRealtimeTransport,
  OpenAIRealtimeTransport,
} from "../../lib/realtime-transport";

const useMocks = import.meta.env.WXT_PUBLIC_USE_MOCKS === "true";
const apiBaseUrl =
  import.meta.env.WXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8787";

function createCaptureController(): CaptureController {
  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken: getStoredAccessToken,
  });

  return new CaptureController({
    getSourceTab: getActiveSourceTab,
    captureAudio: captureActiveTabAudio,
    sendMessage: sendExtensionMessage,
    createRealtimeTransport: () =>
      useMocks
        ? new MockRealtimeTransport()
        : new OpenAIRealtimeTransport(apiClient),
  });
}

export function useCapture() {
  const controller = useMemo(createCaptureController, []);
  const [state, setState] = useState<CaptureState>(controller.state);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      return () => {
        unsubscribe();
        void controller.dispose();
      };
    }
    const onMessage = (rawMessage: unknown) => {
      const parsed = ExtensionMessageSchema.safeParse(rawMessage);
      if (parsed.success && parsed.data.type === "capture:stop-requested") {
        void controller.stop(parsed.data.reason);
      }
    };
    const onPageHide = () => void controller.dispose();

    chrome.runtime.onMessage.addListener(onMessage);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      unsubscribe();
      chrome.runtime.onMessage.removeListener(onMessage);
      window.removeEventListener("pagehide", onPageHide);
      void controller.dispose();
    };
  }, [controller]);

  return {
    state,
    start: () => controller.start(),
    stop: () => controller.stop("user"),
    useMocks,
  };
}
