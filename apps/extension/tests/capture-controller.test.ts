// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { CaptureController } from "../src/lib/capture-controller";
import type {
  RealtimeTransport,
  RealtimeTransportCallbacks,
} from "../src/lib/realtime-transport";

describe("CaptureController", () => {
  it("replays tab audio, publishes final text, and clears all session state", async () => {
    const stopTrack = vi.fn();
    const track = {
      addEventListener: vi.fn(),
      stop: stopTrack,
    } as unknown as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream;

    const connectSource = vi.fn();
    const disconnectSource = vi.fn();
    const closeContext = vi.fn(async () => undefined);
    const audioContext = {
      destination: {},
      createMediaStreamSource: () => ({
        connect: connectSource,
        disconnect: disconnectSource,
      }),
      createAnalyser: () => ({
        fftSize: 512,
        getByteTimeDomainData: (samples: Uint8Array) => samples.fill(128),
      }),
      resume: vi.fn(async () => undefined),
      close: closeContext,
    } as unknown as AudioContext;

    const closeRealtime = vi.fn();
    const realtime: RealtimeTransport = {
      connect: async (
        _capturedStream: MediaStream,
        callbacks: RealtimeTransportCallbacks,
      ) => {
        callbacks.onEvent({
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "line-1",
          content_index: 0,
          transcript: "That ship has sailed.",
        });
      },
      close: closeRealtime,
    };
    const sendMessage = vi.fn(async () => undefined);
    const controller = new CaptureController({
      getSourceTab: async () => ({
        id: 42,
        title: "Synthetic audio",
        origin: "https://example.com",
      }),
      captureAudio: async () => stream,
      createRealtimeTransport: () => realtime,
      sendMessage,
      createAudioContext: () => audioContext,
    });

    await controller.start();

    expect(controller.state.phase).toBe("capturing");
    expect(controller.state.lines[0]).toMatchObject({
      text: "That ship has sailed.",
      status: "final",
    });
    expect(connectSource).toHaveBeenCalledWith(audioContext.destination);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "overlay:update", tab_id: 42 }),
    );

    await controller.stop("user");

    expect(controller.state).toMatchObject({
      phase: "idle",
      lines: [],
      source: null,
    });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(disconnectSource).toHaveBeenCalledOnce();
    expect(closeContext).toHaveBeenCalledOnce();
    expect(closeRealtime).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "overlay:clear",
      tab_id: 42,
    });
  });
});
