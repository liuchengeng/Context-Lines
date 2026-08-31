import {
  TranscriptContextSchema,
  type TranscriptContext,
  type TranscriptExcerpt,
  type TranscriptLine,
} from "@contextlines/contracts";

import type { SourceTab } from "./chrome-capture";

function excerpt(line: TranscriptLine): TranscriptExcerpt {
  return {
    id: line.id,
    sequence: line.sequence,
    text: line.text,
  };
}

export function buildTranscriptContext(
  lines: TranscriptLine[],
  currentId: string,
  source: SourceTab,
): TranscriptContext {
  const finalLines = lines
    .filter((line) => line.status === "final")
    .sort((a, b) => a.sequence - b.sequence);
  const currentIndex = finalLines.findIndex((line) => line.id === currentId);
  if (currentIndex < 0) {
    throw new Error("Only a final transcript line can be analyzed");
  }
  const current = finalLines[currentIndex];
  if (!current) throw new Error("Selected transcript line is unavailable");
  const next = finalLines[currentIndex + 1];

  return TranscriptContextSchema.parse({
    previous: finalLines
      .slice(Math.max(0, currentIndex - 3), currentIndex)
      .map(excerpt),
    current: excerpt(current),
    ...(next ? { next: excerpt(next) } : {}),
    page: {
      title: source.title,
      origin: source.origin,
    },
  });
}

export async function contextFingerprint(
  context: TranscriptContext,
): Promise<string> {
  const canonical = JSON.stringify(context);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
