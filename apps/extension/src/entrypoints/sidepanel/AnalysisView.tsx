import type {
  ClassifiedText,
  DeepAnalysis,
  ExpressionChunk,
  QuickAnalysis,
  SaveExpressionInput,
} from "@contextlines/contracts";
import { SaveExpressionInputSchema } from "@contextlines/contracts";
import { useEffect, useState } from "react";

import type { AnalysisState } from "../../lib/analysis-controller";

const CLASSIFICATION_LABELS = {
  language_fact: "语言事实",
  scene_inference: "场景推断",
  external_fact: "外部事实，未联网核实",
} as const;

function ClassifiedNote({ note }: { note: ClassifiedText }) {
  return (
    <div className={`classified-note classification-${note.classification}`}>
      <p>{note.text}</p>
      <span>
        {CLASSIFICATION_LABELS[note.classification]} ·{" "}
        {Math.round(note.confidence * 100)}%
      </span>
    </div>
  );
}

function SaveExpressionForm({
  chunk,
  quick,
  canSave,
  saving,
  message,
  error,
  onSave,
}: {
  chunk: ExpressionChunk;
  quick: QuickAnalysis;
  canSave: boolean;
  saving: boolean;
  message: string | null;
  error: string | null;
  onSave: (input: SaveExpressionInput) => Promise<void>;
}) {
  const [personalExample, setPersonalExample] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setPersonalExample("");
    setLocalError(null);
  }, [chunk.text]);

  const submit = async () => {
    const parsed = SaveExpressionInputSchema.safeParse({
      expression: chunk.text,
      source_transcript: quick.transcript,
      meaning_zh: chunk.meaning_zh.text,
      intent: quick.intent.text,
      usage_note: chunk.usage_note.text,
      personal_example: personalExample,
      meaning_classification: chunk.meaning_zh.classification,
      schema_version: 1,
    });
    if (!parsed.success) {
      setLocalError("个人例句必须包含所选表达块，且不能留空。");
      return;
    }
    setLocalError(null);
    await onSave(parsed.data).catch(() => undefined);
  };

  return (
    <div className="save-expression-form">
      <label htmlFor="personal-example">我的例句</label>
      <textarea
        id="personal-example"
        value={personalExample}
        maxLength={600}
        rows={3}
        placeholder={`写一个包含 “${chunk.text}” 的个人例句`}
        onChange={(event) => setPersonalExample(event.target.value)}
      />
      <p className="form-help">例句用于挖空卡，不会保存完整转写历史。</p>
      {localError || error ? (
        <p className="form-error" role="alert">
          {localError ?? error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      <button
        className="button-secondary save-button"
        type="button"
        disabled={!canSave || saving}
        onClick={() => void submit()}
      >
        {!canSave ? "登录后收藏" : saving ? "正在收藏…" : "收藏并创建三张卡"}
      </button>
    </div>
  );
}

function QuickSection({
  quick,
  canSave,
  saving,
  message,
  error,
  onSave,
}: {
  quick: QuickAnalysis;
  canSave: boolean;
  saving: boolean;
  message: string | null;
  error: string | null;
  onSave: (input: SaveExpressionInput) => Promise<void>;
}) {
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const chunk = quick.chunks.find((item) => item.text === selectedChunk);

  useEffect(() => {
    if (selectedChunk && !chunk) setSelectedChunk(null);
  }, [chunk, selectedChunk]);

  return (
    <>
      {quick.insufficient_context ? (
        <p className="context-warning">
          当前语境不足，以下意图和场景判断包含保守推断。
        </p>
      ) : null}

      <div className="analysis-grid">
        <section className="analysis-field emphasis-field">
          <h3>自然中文</h3>
          <ClassifiedNote note={quick.natural_zh} />
        </section>
        <section className="analysis-field">
          <h3>字面中文</h3>
          <ClassifiedNote note={quick.literal_zh} />
        </section>
        <section className="analysis-field">
          <h3>意图</h3>
          <ClassifiedNote note={quick.intent} />
        </section>
        <section className="analysis-field">
          <h3>语气</h3>
          <ClassifiedNote note={quick.tone} />
        </section>
        <section className="analysis-field">
          <h3>语域</h3>
          <ClassifiedNote note={quick.register} />
        </section>
      </div>

      <section className="chunks-section">
        <div className="subheading-row">
          <h3>表达块</h3>
          <span>选择后可收藏</span>
        </div>
        {quick.chunks.length === 0 ? (
          <p className="muted-copy">当前台词没有足够明确的可收藏表达块。</p>
        ) : (
          <div className="chunk-list">
            {quick.chunks.map((chunk) => (
              <button
                type="button"
                className={`chunk-row ${selectedChunk === chunk.text ? "selected" : ""}`}
                key={chunk.text}
                onClick={() => setSelectedChunk(chunk.text)}
              >
                <span className="chunk-copy">
                  <strong>{chunk.text}</strong>
                  <span>{chunk.meaning_zh.text}</span>
                </span>
                <span className="chunk-check" aria-hidden="true">
                  {selectedChunk === chunk.text ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        {chunk ? (
          <SaveExpressionForm
            chunk={chunk}
            quick={quick}
            canSave={canSave}
            saving={saving}
            message={message}
            error={error}
            onSave={onSave}
          />
        ) : null}
      </section>

      {quick.scene_inference.length > 0 ? (
        <section className="analysis-field">
          <h3>场景判断</h3>
          <div className="note-list">
            {quick.scene_inference.map((note) => (
              <ClassifiedNote key={note.text} note={note} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function DeepSection({ deep }: { deep: DeepAnalysis }) {
  return (
    <section className="deep-section" aria-labelledby="deep-heading">
      <div className="subheading-row">
        <h3 id="deep-heading">深入解释</h3>
        <span>{Math.round(deep.confidence * 100)}% 信心</span>
      </div>
      <div className="deep-block">
        <h4>潜台词</h4>
        <ClassifiedNote note={deep.implied_meaning} />
      </div>
      <div className="deep-block">
        <h4>语用功能</h4>
        <ClassifiedNote note={deep.pragmatic_function} />
      </div>
      <div className="deep-block">
        <h4>使用提醒</h4>
        <div className="note-list">
          {deep.usage_notes.map((note) => (
            <ClassifiedNote key={note.text} note={note} />
          ))}
        </div>
      </div>
      <div className="deep-block">
        <h4>例句变化</h4>
        <div className="example-list">
          {deep.example_variants.map((example) => (
            <article key={example.english}>
              <strong>{example.english}</strong>
              <p>{example.natural_zh}</p>
              <ClassifiedNote note={example.context} />
            </article>
          ))}
        </div>
      </div>
      <div className="deep-block">
        <h4>不适用场景</h4>
        <div className="note-list">
          {deep.inappropriate_contexts.map((note) => (
            <ClassifiedNote key={note.text} note={note} />
          ))}
        </div>
      </div>
      {deep.cultural_context.length > 0 ? (
        <div className="deep-block">
          <h4>文化语境</h4>
          <div className="note-list">
            {deep.cultural_context.map((note) => (
              <ClassifiedNote key={note.text} note={note} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AnalysisView({
  state,
  onRequestDeep,
  canSave,
  saving,
  saveMessage,
  saveError,
  onSaveExpression,
}: {
  state: AnalysisState;
  onRequestDeep: () => Promise<void>;
  canSave: boolean;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
  onSaveExpression: (input: SaveExpressionInput) => Promise<void>;
}) {
  if (!state.selectedLineId) {
    return (
      <section className="study-empty">
        <p className="eyebrow">Study Mode</p>
        <h2>先在 Flow 中点击一条确认台词</h2>
        <p>ContextLines 不会自动翻译。只有你的点击才会发送有限上下文。</p>
      </section>
    );
  }

  return (
    <div className="study-content">
      <header className="selected-line">
        <p className="eyebrow">正在分析</p>
        <blockquote>{state.context?.current.text}</blockquote>
        {state.refreshing ? <span>正在结合后一句静默更新…</span> : null}
      </header>

      {state.phase === "quick-loading" ? (
        <div className="analysis-loading" role="status">
          <span />
          <span />
          <span />
          <p>正在生成快速分析…</p>
        </div>
      ) : null}

      {state.error ? (
        <p className="analysis-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.quick ? (
        <QuickSection
          quick={state.quick}
          canSave={canSave}
          saving={saving}
          message={saveMessage}
          error={saveError}
          onSave={onSaveExpression}
        />
      ) : null}

      {state.quick && !state.deep ? (
        <button
          className="button-secondary deep-button"
          type="button"
          disabled={state.phase === "deep-loading"}
          onClick={() => void onRequestDeep()}
        >
          {state.phase === "deep-loading" ? "正在深入解释…" : "深入解释"}
        </button>
      ) : null}

      {state.deep ? <DeepSection deep={state.deep} /> : null}
    </div>
  );
}
