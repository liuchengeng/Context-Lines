import {
  QuickAskViewStateSchema,
  type QuickAskViewState,
} from "@contextlines/contracts";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STATE_KEY = "quickAskViewState";

function App() {
  const [state, setState] = useState<QuickAskViewState>({ status: "loading" });

  useEffect(() => {
    const load = async () => {
      const value = (await chrome.storage.session.get(STATE_KEY))[STATE_KEY];
      const parsed = QuickAskViewStateSchema.safeParse(value);
      if (parsed.success) setState(parsed.data);
    };
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "session" || !changes[STATE_KEY]) return;
      const parsed = QuickAskViewStateSchema.safeParse(
        changes[STATE_KEY].newValue,
      );
      if (parsed.success) setState(parsed.data);
    };
    void load();
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const close = () => window.close();

  return (
    <main>
      <header>
        <span className="mark">Q</span>
        <span>刚才这句是什么意思？</span>
        <kbd>Esc</kbd>
      </header>
      {state.status === "loading" && (
        <section className="loading">
          <span className="spinner" />
          正在听写并解释…
        </section>
      )}
      {state.status === "error" && (
        <section className="error">
          <h1>没听清</h1>
          <p>{state.message}</p>
          <button onClick={close}>继续播放</button>
        </section>
      )}
      {state.status === "answer" && (
        <section className="answer">
          <p className="eyebrow">听到的英文</p>
          <h1>{state.answer.transcript}</h1>
          <div className="meaning">
            <strong>{state.answer.phrase}</strong>
            <p>{state.answer.meaning_zh}</p>
          </div>
          <dl>
            <div>
              <dt>放在这里</dt>
              <dd>{state.answer.context_zh}</dd>
            </div>
            <div>
              <dt>怎么用</dt>
              <dd>{state.answer.usage_zh}</dd>
            </div>
          </dl>
          <button onClick={close}>明白了，继续播放</button>
        </section>
      )}
    </main>
  );
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.close();
});

createRoot(document.getElementById("root")!).render(<App />);
