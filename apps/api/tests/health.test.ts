import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("worker routes", () => {
  it("returns only status and version", async () => {
    const response = await app.request("http://worker.test/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", version: "0.2.0" });
  });
  it("rejects quick ask without the private access token", async () => {
    const response = await app.request(
      "http://worker.test/v1/quick-ask",
      { method: "POST" },
      {
        ALLOWED_EXTENSION_ID: "extension-id",
        QUICK_ASK_ACCESS_TOKEN: "secret",
      },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "AUTH_REQUIRED",
      retryable: false,
    });
  });
});
