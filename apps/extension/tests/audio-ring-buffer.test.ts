import { describe, expect, it } from "vitest";
import {
  AudioRingBuffer,
  encodeMonoWav,
  resampleLinear,
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
});
