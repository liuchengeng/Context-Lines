import { describe, expect, it } from "vitest";
import { userFacingErrorMessage } from "../src/lib/user-facing-error";

describe("user-facing errors", () => {
  it("turns browser network errors into a Chinese recovery hint", () => {
    expect(
      userFacingErrorMessage(new TypeError("Failed to fetch"), "连接失败。"),
    ).toBe("网络连接失败，请检查网络和 Worker 地址后重试。");
  });

  it("preserves specific Chinese service errors and uses a fallback", () => {
    expect(
      userFacingErrorMessage(new Error("豆包鉴权失败。"), "连接失败。"),
    ).toBe("豆包鉴权失败。");
    expect(userFacingErrorMessage(null, "连接失败。")).toBe("连接失败。");
  });
});
