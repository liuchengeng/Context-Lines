import { describe, expect, it } from "vitest";

import app from "../src/index";

describe("GET /health", () => {
  it("returns only status and version", async () => {
    const response = await app.request("http://worker.test/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", version: "0.1.0" });
  });
});
