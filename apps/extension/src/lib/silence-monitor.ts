export class SilenceMonitor {
  #interval: number | null = null;
  #timeout: number | null = null;
  #heardAudio = false;

  constructor(
    private readonly analyser: AnalyserNode,
    private readonly onSilent: () => void,
  ) {}

  start(timeoutMs = 8_000): void {
    const samples = new Uint8Array(this.analyser.fftSize);
    this.#interval = window.setInterval(() => {
      this.analyser.getByteTimeDomainData(samples);
      const peak = samples.reduce(
        (currentPeak, value) =>
          Math.max(currentPeak, Math.abs(value - 128) / 128),
        0,
      );
      if (peak > 0.01) this.#heardAudio = true;
    }, 250);
    this.#timeout = window.setTimeout(() => {
      if (!this.#heardAudio) this.onSilent();
      this.stop();
    }, timeoutMs);
  }

  stop(): void {
    if (this.#interval !== null) window.clearInterval(this.#interval);
    if (this.#timeout !== null) window.clearTimeout(this.#timeout);
    this.#interval = null;
    this.#timeout = null;
  }
}
