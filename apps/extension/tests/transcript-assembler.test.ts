import { describe, expect, it } from "vitest";

import { TranscriptAssembler } from "../src/lib/transcript-assembler";

describe("TranscriptAssembler", () => {
  it("accumulates partial deltas and replaces them with the final transcript", () => {
    let now = 100;
    const assembler = new TranscriptAssembler({ now: () => now++ });

    assembler.apply({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "a",
      content_index: 0,
      delta: "Hello",
    });
    const partial = assembler.apply({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "a",
      content_index: 0,
      delta: ", world",
    });

    expect(partial[0]).toMatchObject({
      id: "a",
      text: "Hello, world",
      status: "partial",
    });

    const final = assembler.apply({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "a",
      content_index: 0,
      transcript: "Hello, world.",
    });
    expect(final[0]).toMatchObject({
      text: "Hello, world.",
      status: "final",
      ended_at_ms: 101,
    });
  });

  it("keeps commit order when completions arrive out of order", () => {
    const assembler = new TranscriptAssembler({ now: () => 10 });

    assembler.apply({
      type: "input_audio_buffer.committed",
      item_id: "first",
      previous_item_id: null,
    });
    assembler.apply({
      type: "input_audio_buffer.committed",
      item_id: "second",
      previous_item_id: "first",
    });
    assembler.apply({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "second",
      content_index: 0,
      transcript: "Second line",
    });
    const lines = assembler.apply({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "first",
      content_index: 0,
      transcript: "First line",
    });

    expect(lines.map((line) => line.text)).toEqual([
      "First line",
      "Second line",
    ]);
    expect(lines.map((line) => line.sequence)).toEqual([0, 1]);
  });

  it("retains only the configured in-memory window", () => {
    const assembler = new TranscriptAssembler({ maxLines: 2, now: () => 10 });

    for (const id of ["one", "two", "three"]) {
      assembler.apply({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: id,
        content_index: 0,
        transcript: id,
      });
    }

    expect(assembler.snapshot().map((line) => line.id)).toEqual([
      "two",
      "three",
    ]);
  });
});
