import { describe, expect, it } from "vitest";
import {
  AudioRingBuffer,
  encodeMonoWav,
  resampleLinear,
  trimSilence,
} from "../src/lib/audio-ring-buffer";

describe("AudioRingBuffer", () => {
  it("keeps only the newest samples in chronological order", () => {
    const ring = new AudioRingBuffer(2, 2);
    ring.write(new Float32Array([1, 2, 3]));
    ring.write(new Float32Array([4, 5]));
    expect(Array.from(ring.snapshot(2))).toEqual([2, 3, 4, 5]);
  });
  it("resamples and writes a valid mono PCM wav", () => {
    const downsampled = resampleLinear(new Float32Array([0, 1, 0, -1]), 4, 2);
    expect(downsampled.length).toBe(2);
    const wav = encodeMonoWav(downsampled, 16_000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(wav.byteLength).toBe(48);
  });
  it("removes distant silence and caps continuously active audio", () => {
    const sampleRate = 100;
    const padded = new Float32Array(1_000);
    padded.fill(0.2, 200, 600);
    const trimmed = trimSilence(padded, sampleRate);
    expect(trimmed.length).toBeGreaterThanOrEqual(400);
    expect(trimmed.length).toBeLessThan(600);

    const continuous = new Float32Array(1_000).fill(0.2);
    expect(trimSilence(continuous, sampleRate)).toHaveLength(800);
  });
});
