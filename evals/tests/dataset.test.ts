import type { ClassifiedText } from "@contextlines/contracts";
import {
  DeepAnalysisSchema,
  QuickAnalysisSchema,
  TranscriptContextSchema,
} from "@contextlines/contracts";
import { describe, expect, it } from "vitest";

import { EVAL_CATEGORIES, evalDataset } from "../src/dataset";

function classifiedNotes(value: unknown): ClassifiedText[] {
  if (Array.isArray(value)) return value.flatMap(classifiedNotes);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own =
    typeof record.text === "string" &&
    typeof record.classification === "string" &&
    typeof record.confidence === "number"
      ? [record as unknown as ClassifiedText]
      : [];
  return [...own, ...Object.values(record).flatMap(classifiedNotes)];
}

describe("100-case synthetic pragmatic evaluation dataset", () => {
  it("contains exactly 100 unique, schema-valid synthetic cases", () => {
    expect(evalDataset).toHaveLength(100);
    expect(new Set(evalDataset.map((item) => item.id)).size).toBe(100);
    for (const item of evalDataset) {
      expect(item.synthetic).toBe(true);
      expect(TranscriptContextSchema.safeParse(item.context).success).toBe(
        true,
      );
      expect(QuickAnalysisSchema.safeParse(item.referenceQuick).success).toBe(
        true,
      );
      expect(DeepAnalysisSchema.safeParse(item.referenceDeep).success).toBe(
        true,
      );
    }
  });

  it("covers every required category with at least ten cases", () => {
    for (const category of EVAL_CATEGORIES) {
      expect(
        evalDataset.filter((item) => item.category === category).length,
      ).toBeGreaterThanOrEqual(10);
    }
  });

  it("never disguises external facts as verified claims", () => {
    const notes = evalDataset.flatMap((item) =>
      classifiedNotes({
        quick: item.referenceQuick,
        deep: item.referenceDeep,
      }),
    );
    const external = notes.filter(
      (note) => note.classification === "external_fact",
    );
    expect(external.length).toBeGreaterThan(0);
    expect(external.every((note) => note.text.includes("未联网核实"))).toBe(
      true,
    );
    for (const item of evalDataset.filter(
      (candidate) => candidate.category === "pop_culture",
    )) {
      expect(item.referenceDeep.cultural_context).not.toHaveLength(0);
      expect(
        item.referenceDeep.cultural_context.every(
          (note) => note.classification === "external_fact",
        ),
      ).toBe(true);
    }
  });

  it("contains no speaker labels or identity guesses", () => {
    const serialized = JSON.stringify(evalDataset);
    expect(serialized).not.toMatch(/Speaker\s+[A-Z]|说话人\s*[A-Z]/i);
    expect(serialized).not.toMatch(/真实身份|扮演者|演员是|名叫/);
  });
});
