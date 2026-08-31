import { describe, expect, it } from "vitest";

import { AuthController, isAllowedAuthEmail } from "../src/lib/auth-controller";

describe("AuthController mock mode", () => {
  it("provides an allowed synthetic user without remote OAuth", async () => {
    const controller = new AuthController(true);
    await controller.initialize();

    expect(controller.state).toMatchObject({
      phase: "signed-in",
      user: { email: "learner@example.com" },
    });
  });

  it("rejects an email outside the configured single-user boundary", () => {
    expect(
      isAllowedAuthEmail("learner@example.com", "LEARNER@example.com"),
    ).toBe(true);
    expect(isAllowedAuthEmail("other@example.com", "learner@example.com")).toBe(
      false,
    );
    expect(isAllowedAuthEmail("learner@example.com", null)).toBe(false);
  });
});
