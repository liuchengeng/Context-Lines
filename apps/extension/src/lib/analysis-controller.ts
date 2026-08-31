import type {
  AnalysisProvider,
  DeepAnalysis,
  QuickAnalysis,
  TranscriptContext,
  TranscriptLine,
} from "@contextlines/contracts";

import type { SourceTab } from "./chrome-capture";
import {
  buildTranscriptContext,
  contextFingerprint,
} from "./transcript-context";

export type AnalysisPhase =
  "idle" | "quick-loading" | "ready" | "deep-loading" | "error";

export interface AnalysisState {
  phase: AnalysisPhase;
  selectedLineId: string | null;
  context: TranscriptContext | null;
  quick: QuickAnalysis | null;
  deep: DeepAnalysis | null;
  refreshing: boolean;
  error: string | null;
}

const INITIAL_STATE: AnalysisState = {
  phase: "idle",
  selectedLineId: null,
  context: null,
  quick: null,
  deep: null,
  refreshing: false,
  error: null,
};

type AnalysisListener = (state: AnalysisState) => void;

export class AnalysisController {
  readonly #listeners = new Set<AnalysisListener>();
  readonly #quickCache = new Map<string, Promise<QuickAnalysis>>();
  readonly #deepCache = new Map<string, Promise<DeepAnalysis>>();
  readonly #refreshedWithNext = new Set<string>();
  #state: AnalysisState = INITIAL_STATE;
  #requestVersion = 0;

  constructor(private readonly provider: AnalysisProvider) {}

  get state(): AnalysisState {
    return this.#state;
  }

  subscribe(listener: AnalysisListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async selectLine(
    lineId: string,
    lines: TranscriptLine[],
    source: SourceTab,
  ): Promise<void> {
    const context = buildTranscriptContext(lines, lineId, source);
    const version = ++this.#requestVersion;
    this.#setState({
      phase: "quick-loading",
      selectedLineId: lineId,
      context,
      quick: null,
      deep: null,
      refreshing: false,
      error: null,
    });

    try {
      const quick = await this.#quick(context);
      if (version !== this.#requestVersion) return;
      this.#setState({ ...this.#state, phase: "ready", quick });
    } catch {
      if (version !== this.#requestVersion) return;
      this.#setState({
        ...this.#state,
        phase: "error",
        error: "快速分析失败，未显示或保存无效结果。",
      });
    }
  }

  async updateTranscript(
    lines: TranscriptLine[],
    source: SourceTab | null,
  ): Promise<void> {
    const selectedLineId = this.#state.selectedLineId;
    const currentContext = this.#state.context;
    if (
      !source ||
      !selectedLineId ||
      !currentContext ||
      !this.#state.quick ||
      currentContext.next ||
      this.#refreshedWithNext.has(selectedLineId)
    ) {
      return;
    }

    let nextContext: TranscriptContext;
    try {
      nextContext = buildTranscriptContext(lines, selectedLineId, source);
    } catch {
      return;
    }
    if (!nextContext.next) return;

    this.#refreshedWithNext.add(selectedLineId);
    const version = ++this.#requestVersion;
    this.#setState({
      ...this.#state,
      context: nextContext,
      refreshing: true,
      error: null,
    });
    try {
      const quick = await this.#quick(nextContext);
      if (version !== this.#requestVersion) return;
      this.#setState({
        ...this.#state,
        phase: "ready",
        quick,
        deep: null,
        refreshing: false,
      });
    } catch {
      if (version !== this.#requestVersion) return;
      this.#setState({
        ...this.#state,
        phase: "ready",
        refreshing: false,
        error: "后续语境刷新失败，已保留原分析。",
      });
    }
  }

  async requestDeep(): Promise<void> {
    const context = this.#state.context;
    const quick = this.#state.quick;
    if (!context || !quick) return;

    const version = ++this.#requestVersion;
    this.#setState({
      ...this.#state,
      phase: "deep-loading",
      error: null,
    });
    try {
      const contextKey = await contextFingerprint(context);
      const quickKey = await this.#hash(JSON.stringify(quick));
      const cacheKey = `${contextKey}:${quickKey}`;
      let request = this.#deepCache.get(cacheKey);
      if (!request) {
        request = this.provider.deep(context, quick);
        this.#deepCache.set(cacheKey, request);
        void request.catch(() => {
          if (this.#deepCache.get(cacheKey) === request) {
            this.#deepCache.delete(cacheKey);
          }
        });
      }
      const deep = await request;
      if (version !== this.#requestVersion) return;
      this.#setState({ ...this.#state, phase: "ready", deep });
    } catch {
      if (version !== this.#requestVersion) return;
      this.#setState({
        ...this.#state,
        phase: "error",
        error: "深入解释失败，未显示或保存无效结果。",
      });
    }
  }

  reset(): void {
    ++this.#requestVersion;
    this.#setState(INITIAL_STATE);
  }

  async #quick(context: TranscriptContext): Promise<QuickAnalysis> {
    const key = await contextFingerprint(context);
    let request = this.#quickCache.get(key);
    if (!request) {
      request = this.provider.quick(context);
      this.#quickCache.set(key, request);
      void request.catch(() => {
        if (this.#quickCache.get(key) === request) {
          this.#quickCache.delete(key);
        }
      });
    }
    return request;
  }

  async #hash(value: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  #setState(state: AnalysisState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}
