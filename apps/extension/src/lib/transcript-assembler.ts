import {
  TRANSCRIPT_TEXT_MAX_LENGTH,
  type SupportedRealtimeEvent,
  type TranscriptLine,
} from "@contextlines/contracts";

interface MutableTurn {
  id: string;
  text: string;
  status: "partial" | "final";
  startedAtMs: number;
  endedAtMs?: number;
  firstSeenOrder: number;
  previousItemId: string | null | undefined;
}

export interface TranscriptAssemblerOptions {
  maxLines?: number;
  now?: () => number;
}

export class RealtimeTranscriptError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RealtimeTranscriptError";
  }
}

export class TranscriptAssembler {
  readonly #turns = new Map<string, MutableTurn>();
  readonly #seenEventIds = new Set<string>();
  readonly #maxLines: number;
  readonly #now: () => number;
  #nextFirstSeenOrder = 0;

  constructor(options: TranscriptAssemblerOptions = {}) {
    this.#maxLines = options.maxLines ?? 30;
    this.#now = options.now ?? Date.now;

    if (!Number.isInteger(this.#maxLines) || this.#maxLines < 1) {
      throw new Error(
        "TranscriptAssembler maxLines must be a positive integer",
      );
    }
  }

  apply(event: SupportedRealtimeEvent): TranscriptLine[] {
    if (event.event_id && this.#seenEventIds.has(event.event_id)) {
      return this.snapshot();
    }

    if (event.event_id) {
      this.#seenEventIds.add(event.event_id);
      if (this.#seenEventIds.size > 500) {
        const oldest = this.#seenEventIds.values().next().value as
          string | undefined;
        if (oldest) this.#seenEventIds.delete(oldest);
      }
    }

    switch (event.type) {
      case "input_audio_buffer.committed": {
        const turn = this.#getOrCreateTurn(event.item_id);
        turn.previousItemId = event.previous_item_id;
        break;
      }
      case "conversation.item.input_audio_transcription.delta": {
        if (!event.delta) break;
        const turn = this.#getOrCreateTurn(event.item_id);
        if (turn.status === "partial") {
          turn.text = `${turn.text}${event.delta}`.slice(
            0,
            TRANSCRIPT_TEXT_MAX_LENGTH,
          );
        }
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const turn = this.#getOrCreateTurn(event.item_id);
        const finalText = event.transcript.trim();
        if (!finalText) {
          this.#turns.delete(event.item_id);
          break;
        }
        turn.text = finalText.slice(0, TRANSCRIPT_TEXT_MAX_LENGTH);
        turn.status = "final";
        turn.endedAtMs = this.#now();
        break;
      }
      case "error":
        throw new RealtimeTranscriptError(
          event.error.message,
          event.error.code,
        );
    }

    this.#trim();
    return this.snapshot();
  }

  snapshot(): TranscriptLine[] {
    return this.#orderedTurns()
      .filter((turn) => turn.text.trim().length > 0)
      .map((turn, sequence) => ({
        id: turn.id,
        sequence,
        text: turn.text,
        status: turn.status,
        started_at_ms: turn.startedAtMs,
        ...(turn.endedAtMs === undefined
          ? {}
          : { ended_at_ms: turn.endedAtMs }),
      }));
  }

  reset(): void {
    this.#turns.clear();
    this.#seenEventIds.clear();
    this.#nextFirstSeenOrder = 0;
  }

  #getOrCreateTurn(itemId: string): MutableTurn {
    const existing = this.#turns.get(itemId);
    if (existing) return existing;

    const turn: MutableTurn = {
      id: itemId,
      text: "",
      status: "partial",
      startedAtMs: this.#now(),
      firstSeenOrder: this.#nextFirstSeenOrder++,
      previousItemId: undefined,
    };
    this.#turns.set(itemId, turn);
    return turn;
  }

  #orderedTurns(): MutableTurn[] {
    const turns = [...this.#turns.values()];
    const nextByPrevious = new Map<string, MutableTurn[]>();

    for (const turn of turns) {
      if (!turn.previousItemId) continue;
      const nextTurns = nextByPrevious.get(turn.previousItemId) ?? [];
      nextTurns.push(turn);
      nextByPrevious.set(turn.previousItemId, nextTurns);
    }

    for (const nextTurns of nextByPrevious.values()) {
      nextTurns.sort((a, b) => a.firstSeenOrder - b.firstSeenOrder);
    }

    const roots = turns
      .filter(
        (turn) => !turn.previousItemId || !this.#turns.has(turn.previousItemId),
      )
      .sort((a, b) => a.firstSeenOrder - b.firstSeenOrder);
    const ordered: MutableTurn[] = [];
    const visited = new Set<string>();

    const visit = (turn: MutableTurn) => {
      if (visited.has(turn.id)) return;
      visited.add(turn.id);
      ordered.push(turn);
      for (const next of nextByPrevious.get(turn.id) ?? []) visit(next);
    };

    for (const root of roots) visit(root);
    for (const turn of turns.sort(
      (a, b) => a.firstSeenOrder - b.firstSeenOrder,
    )) {
      visit(turn);
    }

    return ordered;
  }

  #trim(): void {
    while (this.#turns.size > this.#maxLines) {
      const ordered = this.#orderedTurns();
      const removable =
        ordered.find((turn) => turn.status === "final") ?? ordered[0];
      if (!removable) return;
      this.#turns.delete(removable.id);

      for (const turn of this.#turns.values()) {
        if (turn.previousItemId === removable.id) {
          turn.previousItemId = removable.previousItemId;
        }
      }
    }
  }
}
