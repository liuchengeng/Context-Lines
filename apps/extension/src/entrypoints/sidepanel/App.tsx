import { CONTRACT_VERSION } from "@contextlines/contracts";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <span className="wordmark">ContextLines</span>
        <span className="version">v{CONTRACT_VERSION}</span>
      </header>
      <section className="empty-state" aria-labelledby="baseline-title">
        <p className="eyebrow">Chrome-first MVP</p>
        <h1 id="baseline-title">项目基线已就绪</h1>
        <p>捕获、点句分析与复习流程将在任务分支分阶段实现。</p>
      </section>
    </main>
  );
}
