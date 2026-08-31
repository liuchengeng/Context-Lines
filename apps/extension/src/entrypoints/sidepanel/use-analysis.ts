import { useEffect, useMemo, useState } from "react";

import {
  AnalysisController,
  type AnalysisState,
} from "../../lib/analysis-controller";
import {
  MockAnalysisProvider,
  WorkerAnalysisProvider,
} from "../../lib/analysis-provider";
import { getStoredAccessToken, type SourceTab } from "../../lib/chrome-capture";
import type { TranscriptLine } from "@contextlines/contracts";

const useMocks = import.meta.env.WXT_PUBLIC_USE_MOCKS === "true";
const apiBaseUrl =
  import.meta.env.WXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8787";

function createAnalysisController(): AnalysisController {
  return new AnalysisController(
    useMocks
      ? new MockAnalysisProvider()
      : new WorkerAnalysisProvider({
          baseUrl: apiBaseUrl,
          getAccessToken: getStoredAccessToken,
        }),
  );
}

export function useAnalysis(lines: TranscriptLine[], source: SourceTab | null) {
  const controller = useMemo(createAnalysisController, []);
  const [state, setState] = useState<AnalysisState>(controller.state);

  useEffect(() => controller.subscribe(setState), [controller]);

  useEffect(() => {
    if (!source) {
      if (controller.state.selectedLineId) controller.reset();
      return;
    }
    void controller.updateTranscript(lines, source);
  }, [controller, lines, source]);

  return {
    state,
    selectLine: (lineId: string) =>
      source ? controller.selectLine(lineId, lines, source) : Promise.resolve(),
    requestDeep: () => controller.requestDeep(),
    reset: () => controller.reset(),
  };
}
