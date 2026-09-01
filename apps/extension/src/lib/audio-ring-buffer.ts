const WAV_HEADER_BYTES = 44;

export class AudioRingBuffer {
  private readonly samples: Float32Array;
  private writeIndex = 0;
  private sampleCount = 0;

  constructor(
    readonly sampleRate: number,
    seconds = 12,
  ) {
    this.samples = new Float32Array(Math.ceil(sampleRate * seconds));
  }

  write(chunk: Float32Array): void {
    for (const sample of chunk) {
      this.samples[this.writeIndex] = sample;
      this.writeIndex = (this.writeIndex + 1) % this.samples.length;
    }
    this.sampleCount = Math.min(
      this.samples.length,
      this.sampleCount + chunk.length,
    );
  }

  snapshot(seconds = 10): Float32Array {
    const length = Math.min(
      this.sampleCount,
      Math.floor(this.sampleRate * seconds),
    );
    const result = new Float32Array(length);
    const start =
      (this.writeIndex - length + this.samples.length) % this.samples.length;
    for (let index = 0; index < length; index += 1) {
      result[index] = this.samples[(start + index) % this.samples.length] ?? 0;
    }
    return result;
  }

  clear(): void {
    this.samples.fill(0);
    this.writeIndex = 0;
    this.sampleCount = 0;
  }
}

export function resampleLinear(
  input: Float32Array,
  inputRate: number,
  outputRate = 16_000,
): Float32Array {
  if (inputRate === outputRate) return input.slice();
  const outputLength = Math.max(
    1,
    Math.round((input.length * outputRate) / inputRate),
  );
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[index] =
      (input[left] ?? 0) * (1 - fraction) + (input[right] ?? 0) * fraction;
  }
  return output;
}

export function trimSilence(
  input: Float32Array,
  sampleRate: number,
  maxSeconds = 8,
): Float32Array {
  if (input.length === 0 || sampleRate <= 0) return input.slice();

  const frameSize = Math.max(1, Math.round(sampleRate * 0.02));
  const frameRms: number[] = [];
  for (let start = 0; start < input.length; start += frameSize) {
    const end = Math.min(input.length, start + frameSize);
    let energy = 0;
    for (let index = start; index < end; index += 1) {
      const sample = input[index] ?? 0;
      energy += sample * sample;
    }
    frameRms.push(Math.sqrt(energy / Math.max(1, end - start)));
  }

  const peakRms = Math.max(...frameRms);
  if (peakRms < 0.001) return input.slice();
  const activeThreshold = Math.max(0.002, Math.min(0.015, peakRms * 0.12));
  const firstActiveFrame = frameRms.findIndex(
    (value) => value >= activeThreshold,
  );
  let lastActiveFrame = -1;
  for (let index = frameRms.length - 1; index >= 0; index -= 1) {
    if ((frameRms[index] ?? 0) >= activeThreshold) {
      lastActiveFrame = index;
      break;
    }
  }
  if (firstActiveFrame < 0 || lastActiveFrame < 0) return input.slice();

  const beforePadding = Math.round(sampleRate * 0.6);
  const afterPadding = Math.round(sampleRate * 0.35);
  let start = Math.max(0, firstActiveFrame * frameSize - beforePadding);
  const end = Math.min(
    input.length,
    (lastActiveFrame + 1) * frameSize + afterPadding,
  );
  const maxLength = Math.max(1, Math.round(sampleRate * maxSeconds));
  if (end - start > maxLength) start = end - maxLength;
  const minimumLength = Math.min(input.length, Math.round(sampleRate * 1.5));
  if (end - start < minimumLength) start = Math.max(0, end - minimumLength);
  return input.slice(start, end);
}

export function encodeMonoWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = WAV_HEADER_BYTES;
  for (const rawSample of samples) {
    const sample = Math.max(-1, Math.min(1, rawSample));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}
