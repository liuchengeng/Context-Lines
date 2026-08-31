const ACTIVE_CAPTURE_KEY = "contextlines.active_capture";

export interface ActiveCaptureRegistration {
  tabId: number;
  stopRequested: boolean;
}

export interface CaptureSessionStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

function parseRegistration(value: unknown): ActiveCaptureRegistration | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.tabId === "number" &&
    Number.isInteger(candidate.tabId) &&
    candidate.tabId > 0 &&
    typeof candidate.stopRequested === "boolean"
    ? { tabId: candidate.tabId, stopRequested: candidate.stopRequested }
    : null;
}

export class CaptureRegistry {
  #active: ActiveCaptureRegistration | null = null;
  readonly #hydrated: Promise<void>;

  constructor(private readonly storage: CaptureSessionStorage) {
    this.#hydrated = this.#hydrate();
  }

  async get(): Promise<ActiveCaptureRegistration | null> {
    await this.#hydrated;
    return this.#active ? { ...this.#active } : null;
  }

  async start(tabId: number): Promise<void> {
    await this.#hydrated;
    this.#active = { tabId, stopRequested: false };
    await this.storage.set({ [ACTIVE_CAPTURE_KEY]: this.#active });
  }

  async clear(tabId: number): Promise<void> {
    await this.#hydrated;
    if (this.#active?.tabId !== tabId) return;
    this.#active = null;
    await this.storage.remove(ACTIVE_CAPTURE_KEY);
  }

  async markStopRequested(
    tabId: number,
  ): Promise<ActiveCaptureRegistration | null> {
    await this.#hydrated;
    if (
      !this.#active ||
      this.#active.tabId !== tabId ||
      this.#active.stopRequested
    ) {
      return null;
    }
    this.#active = { ...this.#active, stopRequested: true };
    await this.storage.set({ [ACTIVE_CAPTURE_KEY]: this.#active });
    return { ...this.#active };
  }

  async #hydrate(): Promise<void> {
    const values = await this.storage.get(ACTIVE_CAPTURE_KEY);
    this.#active = parseRegistration(values[ACTIVE_CAPTURE_KEY]);
    if (values[ACTIVE_CAPTURE_KEY] !== undefined && !this.#active) {
      await this.storage.remove(ACTIVE_CAPTURE_KEY);
    }
  }
}
