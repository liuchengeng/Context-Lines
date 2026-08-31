import type {
  ExtensionMessage,
  SupportedRealtimeEvent,
  TranscriptLine,
} from "@contextlines/contracts";

import type { SourceTab } from "./chrome-capture";
import { CaptureError, toCaptureError } from "./errors";
import type { RealtimeTransport } from "./realtime-transport";
import { SilenceMonitor } from "./silence-monitor";
import {
  RealtimeTranscriptError,
  TranscriptAssembler,
} from "./transcript-assembler";

export type CapturePhase =
  "idle" | "starting" | "capturing" | "stopping" | "error";

export type CaptureStopReason =
  | "user"
  | "panel-closed"
  | "active-tab-changed"
  | "source-navigation"
  | "source-tab-closed"
  | "track-ended"
  | "realtime-disconnected"
  | "signed-out";

export interface CaptureState {
  phase: CapturePhase;
  source: SourceTab | null;
  lines: TranscriptLine[];
  error: CaptureError | null;
  warning: string | null;
}

export interface CaptureControllerDependencies {
  getSourceTab: () => Promise<SourceTab>;
  captureAudio: () => Promise<MediaStream>;
  createRealtimeTransport: () => RealtimeTransport;
  sendMessage: (message: ExtensionMessage) => Promise<void>;
  createAudioContext?: () => AudioContext;
}

type CaptureListener = (state: CaptureState) => void;

const INITIAL_STATE: CaptureState = {
  phase: "idle",
  source: null,
  lines: [],
  error: null,
  warning: null,
};

export class CaptureController {
  readonly #listeners = new Set<CaptureListener>();
  readonly #assembler = new TranscriptAssembler({ maxLines: 30 });
  readonly #createAudioContext: () => AudioContext;
  #state: CaptureState = INITIAL_STATE;
  #stream: MediaStream | null = null;
  #audioContext: AudioContext | null = null;
  #audioSource: MediaStreamAudioSourceNode | null = null;
  #realtimeTransport: RealtimeTransport | null = null;
  #silenceMonitor: SilenceMonitor | null = null;
  #operation = 0;

  constructor(private readonly dependencies: CaptureControllerDependencies) {
    this.#createAudioContext =
      dependencies.createAudioContext ?? (() => new AudioContext());
  }

  get state(): CaptureState {
    return this.#state;
  }

  subscribe(listener: CaptureListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.#state.phase === "starting" || this.#state.phase === "capturing") {
      return;
    }

    const operation = ++this.#operation;
    this.#setState({
      phase: "starting",
      source: null,
      lines: [],
      error: null,
      warning: null,
    });

    try {
      const source = await this.dependencies.getSourceTab();
      if (operation !== this.#operation) return;
      this.#setState({ ...this.#state, source });

      const stream = await this.dependencies.captureAudio();
      if (operation !== this.#operation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new CaptureError(
          "no-audio",
          "这个标签页没有可捕获的音轨。",
          true,
        );
      }

      this.#stream = stream;
      audioTrack.addEventListener("ended", () => {
        if (
          this.#state.phase === "starting" ||
          this.#state.phase === "capturing"
        ) {
          void this.stop("track-ended");
        }
      });

      const audioContext = this.#createAudioContext();
      this.#audioContext = audioContext;
      const audioSource = audioContext.createMediaStreamSource(stream);
      this.#audioSource = audioSource;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioSource.connect(analyser);
      audioSource.connect(audioContext.destination);
      await audioContext.resume();

      this.#silenceMonitor = new SilenceMonitor(analyser, () => {
        this.#setState({
          ...this.#state,
          warning: "暂未检测到声音。请确认标签页正在播放音频且未静音。",
        });
      });
      this.#silenceMonitor.start();

      await this.dependencies.sendMessage({
        type: "capture:started",
        tab_id: source.id,
        origin: source.origin,
      });

      const realtimeTransport = this.dependencies.createRealtimeTransport();
      this.#realtimeTransport = realtimeTransport;
      await realtimeTransport.connect(stream, {
        onEvent: (event) => this.#handleRealtimeEvent(event),
        onDisconnected: (message) => {
          if (this.#state.phase === "capturing") {
            void this.#fail(
              new CaptureError("realtime", message, true),
              "realtime-disconnected",
            );
          }
        },
      });

      if (operation !== this.#operation) return;
      this.#setState({ ...this.#state, phase: "capturing" });
    } catch (error) {
      if (operation !== this.#operation) return;
      await this.#fail(toCaptureError(error));
    }
  }

  async stop(reason: CaptureStopReason = "user"): Promise<void> {
    if (this.#state.phase === "idle" || this.#state.phase === "stopping") {
      return;
    }

    ++this.#operation;
    this.#setState({ ...this.#state, phase: "stopping" });
    const source = this.#state.source;
    await this.#cleanup(source);
    this.#setState({
      ...INITIAL_STATE,
      warning:
        reason === "track-ended"
          ? "标签页音轨已结束，识别已停止。"
          : reason === "source-navigation" || reason === "active-tab-changed"
            ? "来源标签页已变化，识别已自动停止。"
            : reason === "source-tab-closed"
              ? "来源标签页已关闭，识别已停止。"
              : null,
    });
  }

  async dispose(): Promise<void> {
    if (this.#state.phase !== "idle") await this.stop("panel-closed");
    this.#listeners.clear();
  }

  async #fail(
    error: CaptureError,
    reason: CaptureStopReason = "realtime-disconnected",
  ): Promise<void> {
    ++this.#operation;
    const source = this.#state.source;
    await this.#cleanup(source);
    this.#setState({
      phase: "error",
      source: null,
      lines: [],
      error,
      warning:
        reason === "realtime-disconnected" ? "音频捕获已安全清理。" : null,
    });
  }

  #handleRealtimeEvent(event: SupportedRealtimeEvent): void {
    try {
      const lines = this.#assembler.apply(event);
      const source = this.#state.source;
      this.#setState({ ...this.#state, lines });
      if (source) {
        void this.dependencies.sendMessage({
          type: "overlay:update",
          tab_id: source.id,
          lines: lines.slice(-4),
        });
      }
    } catch (error) {
      const captureError =
        error instanceof RealtimeTranscriptError
          ? new CaptureError("realtime", error.message, true)
          : toCaptureError(error);
      void this.#fail(captureError);
    }
  }

  async #cleanup(source: SourceTab | null): Promise<void> {
    this.#silenceMonitor?.stop();
    this.#silenceMonitor = null;
    this.#realtimeTransport?.close();
    this.#realtimeTransport = null;
    this.#audioSource?.disconnect();
    this.#audioSource = null;
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    if (this.#audioContext)
      await this.#audioContext.close().catch(() => undefined);
    this.#audioContext = null;
    this.#assembler.reset();

    if (source) {
      await Promise.all([
        this.dependencies.sendMessage({
          type: "overlay:clear",
          tab_id: source.id,
        }),
        this.dependencies.sendMessage({
          type: "capture:stopped",
          tab_id: source.id,
        }),
      ]);
    }
  }

  #setState(state: CaptureState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}
