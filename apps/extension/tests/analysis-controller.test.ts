import type {
  AnalysisProvider,
  DeepAnalysis,
  QuickAnalysis,
  TranscriptContext,
  TranscriptLine,
} from "@contextlines/contracts";
import { describe, expect, it } from "vitest";

import { AnalysisController } from "../src/lib/analysis-controller";
import { MockAnalysisProvider } from "../src/lib/analysis-provider";

const source = {
  id: 7,
  title: "Synthetic dialogue",
  origin: "https://example.test",
};

function finalLine(sequence: number, text: string): TranscriptLine {
  return {
    id: `line-${sequence}`,
    sequence,
    text,
    status: "final",
    started_at_ms: sequence * 100,
    ended_at_ms: sequence * 100 + 90,
  };
}

class CountingProvider implements AnalysisProvider {
  readonly delegate = new MockAnalysisProvider();
  quickCalls = 0;
  deepCalls = 0;

  quick(context: TranscriptContext): Promise<QuickAnalysis> {
    this.quickCalls += 1;
    return this.delegate.quick(context);
  }

  deep(
    context: TranscriptContext,
    quick: QuickAnalysis,
  ): Promise<DeepAnalysis> {
    this.deepCalls += 1;
    return this.delegate.deep(context, quick);
  }
}

describe("AnalysisController", () => {
  it("refreshes a preliminary analysis only once when the next line arrives", async () => {
    const provider = new CountingProvider();
    const controller = new AnalysisController(provider);
    const current = finalLine(0, "I wouldn't read too much into it.");

    await controller.selectLine(current.id, [current], source);
    expect(provider.quickCalls).toBe(1);
    expect(controller.state.quick?.insufficient_context).toBe(true);

    const next = finalLine(1, "She was just trying to keep the peace.");
    await controller.updateTranscript([current, next], source);
    await controller.updateTranscript([current, next], source);

    expect(provider.quickCalls).toBe(2);
    expect(controller.state.context?.next?.id).toBe(next.id);
    expect(controller.state.quick?.insufficient_context).toBe(false);
  });

  it("deduplicates quick and deep requests by context fingerprint", async () => {
    const provider = new CountingProvider();
    const controller = new AnalysisController(provider);
    const lines = [
      finalLine(0, "I wouldn't read too much into it."),
      finalLine(1, "She was just trying to keep the peace."),
    ];

    await controller.selectLine(lines[0]!.id, lines, source);
    await controller.selectLine(lines[0]!.id, lines, source);
    expect(provider.quickCalls).toBe(1);

    await controller.requestDeep();
    await controller.requestDeep();
    expect(provider.deepCalls).toBe(1);
    expect(controller.state.deep?.transcript).toBe(lines[0]!.text);
  });
});
