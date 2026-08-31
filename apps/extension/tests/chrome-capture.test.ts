// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { sendExtensionMessage } from "../src/lib/chrome-capture";

describe("sendExtensionMessage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails capture startup when the background cannot persist registration", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({ ok: false })),
      },
    });

    await expect(
      sendExtensionMessage({
        type: "capture:started",
        tab_id: 42,
        origin: "https://example.test",
      }),
    ).rejects.toMatchObject({
      code: "capture-unavailable",
      retryable: true,
    });
  });
});
