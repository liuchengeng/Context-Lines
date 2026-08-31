import type { TranscriptLine } from "@contextlines/contracts";
import { describe, expect, it } from "vitest";

import { buildTranscriptContext } from "../src/lib/transcript-context";

const source = {
  id: 7,
  title: "Synthetic dialogue",
  origin: "https://example.test",
};

function line(
  sequence: number,
  status: TranscriptLine["status"] = "final",
): TranscriptLine {
  return {
    id: `line-${sequence}`,
    sequence,
    text: `Line ${sequence}`,
    status,
    started_at_ms: sequence * 100,
  };
}

describe("buildTranscriptContext", () => {
  it("sends at most three previous lines and one next line", () => {
    const context = buildTranscriptContext(
      [line(0), line(1), line(2), line(3), line(4), line(5)],
      "line-4",
      source,
    );

    expect(context.previous.map((item) => item.id)).toEqual([
      "line-1",
      "line-2",
      "line-3",
    ]);
    expect(context.current.id).toBe("line-4");
    expect(context.next?.id).toBe("line-5");
    expect(context.page).toEqual({
      title: "Synthetic dialogue",
      origin: "https://example.test",
    });
  });

  it("excludes partial transcript lines from analysis context", () => {
    const context = buildTranscriptContext(
      [line(0), line(1, "partial"), line(2)],
      "line-0",
      source,
    );

    expect(context.next?.id).toBe("line-2");
    expect(JSON.stringify(context)).not.toContain("line-1");
  });
});
