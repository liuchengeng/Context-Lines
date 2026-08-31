import { describe, expect, it } from "vitest";

import {
  CaptureRegistry,
  type CaptureSessionStorage,
} from "../src/lib/capture-registry";

function memoryStorage(initial: Record<string, unknown> = {}) {
  const memory = { ...initial };
  const storage: CaptureSessionStorage = {
    async get(key) {
      return { [key]: memory[key] };
    },
    async set(values) {
      Object.assign(memory, values);
    },
    async remove(key) {
      delete memory[key];
    },
  };
  return { memory, storage };
}

describe("CaptureRegistry", () => {
  it("restores capture state after a service worker restart", async () => {
    const { storage } = memoryStorage();
    const firstWorker = new CaptureRegistry(storage);
    await firstWorker.start(42);

    const restartedWorker = new CaptureRegistry(storage);
    expect(await restartedWorker.get()).toEqual({
      tabId: 42,
      stopRequested: false,
    });
    expect(await restartedWorker.markStopRequested(42)).toEqual({
      tabId: 42,
      stopRequested: true,
    });
    expect(await restartedWorker.markStopRequested(42)).toBeNull();
  });

  it("clears only the matching source tab registration", async () => {
    const { storage } = memoryStorage();
    const registry = new CaptureRegistry(storage);
    await registry.start(42);
    await registry.clear(7);
    expect(await registry.get()).not.toBeNull();
    await registry.clear(42);
    expect(await registry.get()).toBeNull();
  });
});
