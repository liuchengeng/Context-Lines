import { describe, expect, it } from "vitest";

import { AuthController } from "../src/lib/auth-controller";

describe("AuthController mock mode", () => {
  it("provides an allowed synthetic user without remote OAuth", async () => {
    const controller = new AuthController(true);
    await controller.initialize();

    expect(controller.state).toMatchObject({
      phase: "signed-in",
      user: { email: "learner@example.com" },
    });
  });
});
