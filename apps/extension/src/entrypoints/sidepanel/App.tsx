import { useEffect, useState } from "react";

import { AnalysisView } from "./AnalysisView";
import { useAnalysis } from "./use-analysis";
import { useCapture } from "./use-capture";

type Mode = "flow" | "study" | "review";

const PHASE_LABELS = {
  idle: "未开始",
  starting: "正在连接",
  capturing: "识别中",
  stopping: "正在停止",
  error: "需要处理",
} as const;

export function App() {
  const [mode, setMode] = useState<Mode>("flow");
  const { state, start, stop, useMocks } = useCapture();
  const analysis = useAnalysis(state.lines, state.source);
  const isBusy = state.phase === "starting" || state.phase === "stopping";
  const isActive = state.phase === "capturing" || state.phase === "starting";

  useEffect(() => {
    if (mode === "study" && !analysis.state.selectedLineId) {
      setMode("flow");
    }
  }, [analysis.state.selectedLineId, mode]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span className="wordmark">ContextLines</span>
        </div>
        <span className={`status-label status-${state.phase}`}>
          <span className="status-dot" aria-hidden="true" />
          {PHASE_LABELS[state.phase]}
        </span>
      </header>

      <nav className="mode-tabs" aria-label="学习模式">
        <button
          className={`mode-tab ${mode === "flow" ? "active" : ""}`}
          type="button"
          aria-current={mode === "flow" ? "page" : undefined}
          onClick={() => setMode("flow")}
        >
          Flow
        </button>
        <button
          className={`mode-tab ${mode === "study" ? "active" : ""}`}
          type="button"
          aria-current={mode === "study" ? "page" : undefined}
          disabled={!analysis.state.selectedLineId}
          onClick={() => setMode("study")}
        >
          Study
        </button>
        <button className="mode-tab" type="button" disabled>
          Review
        </button>
      </nav>

      <div className={`panel-content ${mode === "study" ? "study-panel" : ""}`}>
        {mode === "flow" ? (
          <>
            <section
              className="source-section"
              aria-labelledby="source-heading"
            >
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">来源标签页</p>
                  <h1 id="source-heading">
                    {state.source?.title ?? "准备捕获当前网页音频"}
                  </h1>
                </div>
                {useMocks ? <span className="badge">Mock</span> : null}
              </div>
              <p className="origin">
                {state.source?.origin ?? "仅支持普通 HTTP / HTTPS 标签页"}
              </p>
              <p className="privacy-note">
                音频仅用于实时转写，不由 ContextLines
                保存。中文分析只会在你点击确认台词后生成。
              </p>
              <button
                className={isActive ? "button-secondary" : "button-primary"}
                type="button"
                disabled={isBusy}
                onClick={() => void (isActive ? stop() : start())}
              >
                {state.phase === "starting"
                  ? "正在连接…"
                  : state.phase === "stopping"
                    ? "正在停止…"
                    : isActive
                      ? "停止识别"
                      : "开始识别"}
              </button>
            </section>

            {state.error ? (
              <section className="problem-panel" role="alert">
                <strong>{state.error.message}</strong>
                <span>
                  {state.error.retryable
                    ? "可以修复后重试。"
                    : "此页面或当前状态不支持继续。"}
                </span>
              </section>
            ) : null}

            {state.warning ? (
              <p className="inline-warning" role="status">
                {state.warning}
              </p>
            ) : null}

            <section
              className="transcript-section"
              aria-labelledby="transcript-heading"
            >
              <div className="section-heading-row transcript-heading">
                <div>
                  <p className="eyebrow">实时英文</p>
                  <h2 id="transcript-heading">最近台词</h2>
                </div>
                <span className="line-count">{state.lines.length}</span>
              </div>

              {state.lines.length === 0 ? (
                <div className="transcript-empty">
                  <span className="wave-placeholder" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <p>
                    {state.phase === "capturing"
                      ? "正在等待英文语音…"
                      : "开始识别后，确认台词会显示在这里。"}
                  </p>
                </div>
              ) : (
                <ol className="transcript-list">
                  {state.lines.map((line) => (
                    <li key={line.id}>
                      <button
                        type="button"
                        className={`transcript-line ${line.status}`}
                        disabled={line.status === "partial"}
                        title={
                          line.status === "partial"
                            ? "等待确认"
                            : "点击生成翻译和语用分析"
                        }
                        onClick={() => {
                          if (line.status === "final" && state.source) {
                            setMode("study");
                            void analysis.selectLine(line.id);
                          }
                        }}
                      >
                        <span className="line-text">{line.text}</span>
                        <span className="line-state">
                          {line.status === "partial" ? "识别中" : "分析"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : (
          <AnalysisView
            state={analysis.state}
            onRequestDeep={analysis.requestDeep}
          />
        )}
      </div>
    </main>
  );
}
