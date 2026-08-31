import {
  SupportedRealtimeEventSchema,
  type SupportedRealtimeEvent,
} from "@contextlines/contracts";

import type { ApiClient } from "./api-client";
import { CaptureError } from "./errors";

export interface RealtimeTransportCallbacks {
  onEvent: (event: SupportedRealtimeEvent) => void;
  onDisconnected: (message: string) => void;
}

export interface RealtimeTransport {
  connect(
    stream: MediaStream,
    callbacks: RealtimeTransportCallbacks,
  ): Promise<void>;
  close(): void;
}

export class OpenAIRealtimeTransport implements RealtimeTransport {
  #peerConnection: RTCPeerConnection | null = null;
  #dataChannel: RTCDataChannel | null = null;

  constructor(
    private readonly apiClient: ApiClient,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async connect(
    stream: MediaStream,
    callbacks: RealtimeTransportCallbacks,
  ): Promise<void> {
    const secret = await this.apiClient.createRealtimeClientSecret();
    if (secret.expires_at * 1_000 <= Date.now()) {
      throw new CaptureError("realtime", "识别凭证已过期，请重新开始。", true);
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new CaptureError("no-audio", "这个标签页没有可捕获的音轨。", true);
    }

    const peerConnection = new RTCPeerConnection();
    this.#peerConnection = peerConnection;
    peerConnection.addTrack(audioTrack, stream);

    const dataChannel = peerConnection.createDataChannel("oai-events");
    this.#dataChannel = dataChannel;
    dataChannel.addEventListener("message", (message) => {
      let rawEvent: unknown;
      try {
        rawEvent = JSON.parse(String(message.data));
      } catch {
        return;
      }
      const parsed = SupportedRealtimeEventSchema.safeParse(rawEvent);
      if (parsed.success) callbacks.onEvent(parsed.data);
    });

    peerConnection.addEventListener("connectionstatechange", () => {
      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        callbacks.onDisconnected("Realtime 连接已断开。请重新开始识别。");
      }
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    if (!offer.sdp) {
      throw new CaptureError("realtime", "Chrome 未能创建音频连接描述。", true);
    }

    let response: Response;
    try {
      response = await this.fetcher(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret.value}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );
    } catch {
      throw new CaptureError("network", "无法连接实时识别服务。", true);
    }

    if (!response.ok) {
      throw new CaptureError(
        "realtime",
        response.status === 401
          ? "识别凭证无效或已过期，请重新开始。"
          : "实时识别服务暂时不可用。",
        response.status === 401 ||
          response.status === 429 ||
          response.status >= 500,
      );
    }

    const answerSdp = await response.text();
    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });
  }

  close(): void {
    this.#dataChannel?.close();
    this.#peerConnection?.close();
    this.#dataChannel = null;
    this.#peerConnection = null;
  }
}

export class MockRealtimeTransport implements RealtimeTransport {
  readonly #timers = new Set<number>();

  async connect(
    _stream: MediaStream,
    callbacks: RealtimeTransportCallbacks,
  ): Promise<void> {
    const samples = [
      "I wouldn't read too much into it.",
      "She was just trying to keep the peace.",
      "That ship has sailed, honestly.",
    ];

    samples.forEach((text, index) => {
      const itemId = `mock-${index}`;
      this.#schedule(index * 1_500 + 300, () => {
        callbacks.onEvent({
          type: "input_audio_buffer.committed",
          item_id: itemId,
          previous_item_id: index === 0 ? null : `mock-${index - 1}`,
        });
        callbacks.onEvent({
          type: "conversation.item.input_audio_transcription.delta",
          item_id: itemId,
          content_index: 0,
          delta: text.slice(0, Math.ceil(text.length / 2)),
        });
      });
      this.#schedule(index * 1_500 + 900, () => {
        callbacks.onEvent({
          type: "conversation.item.input_audio_transcription.completed",
          item_id: itemId,
          content_index: 0,
          transcript: text,
        });
      });
    });
  }

  close(): void {
    for (const timer of this.#timers) window.clearTimeout(timer);
    this.#timers.clear();
  }

  #schedule(delayMs: number, callback: () => void): void {
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      callback();
    }, delayMs);
    this.#timers.add(timer);
  }
}
