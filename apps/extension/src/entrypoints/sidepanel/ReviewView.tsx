import type {
  ReviewCard,
  ReviewCardType,
  ReviewRating,
} from "@contextlines/contracts";
import { useEffect, useState } from "react";

import type { LearningState } from "./use-learning";

const CARD_LABELS: Record<ReviewCardType, string> = {
  personal_cloze: "个人例句挖空",
  scene_to_english: "场景到英文",
  english_to_meaning: "英文到含义",
};

const RATING_LABELS: Array<{
  rating: ReviewRating;
  label: string;
}> = [
  { rating: "again", label: "Again" },
  { rating: "hard", label: "Hard" },
  { rating: "good", label: "Good" },
  { rating: "easy", label: "Easy" },
];

function cloze(card: ReviewCard): string {
  const example = card.expression.personal_example;
  const expression = card.expression.expression;
  const index = example
    .toLocaleLowerCase("en-US")
    .indexOf(expression.toLocaleLowerCase("en-US"));
  if (index < 0) return example;
  return `${example.slice(0, index)}________${example.slice(index + expression.length)}`;
}

function promptFor(card: ReviewCard): string {
  switch (card.card_type) {
    case "personal_cloze":
      return cloze(card);
    case "scene_to_english":
      return `你想表达：${card.expression.intent}`;
    case "english_to_meaning":
      return card.expression.expression;
  }
}

function answerFor(card: ReviewCard): string {
  switch (card.card_type) {
    case "personal_cloze":
      return card.expression.personal_example;
    case "scene_to_english":
      return `${card.expression.expression}\n${card.expression.personal_example}`;
    case "english_to_meaning":
      return `${card.expression.meaning_zh}\n${card.expression.usage_note}`;
  }
}

export function ReviewView({
  state,
  onGrade,
  onRefresh,
}: {
  state: LearningState;
  onGrade: (card: ReviewCard, rating: ReviewRating) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const card = state.dueCards[0] ?? null;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => setRevealed(false), [card?.id]);

  if (state.loading) {
    return <p className="review-status">正在加载到期复习卡…</p>;
  }

  if (!card) {
    return (
      <section className="review-empty">
        <p className="eyebrow">Review Mode</p>
        <h2>今天没有到期卡片</h2>
        <p>收藏表达后会自动生成三种卡片。评分只由你决定，不调用 AI。</p>
        <button
          className="button-secondary refresh-button"
          type="button"
          onClick={() => void onRefresh()}
        >
          刷新
        </button>
      </section>
    );
  }

  return (
    <section className="review-content" aria-labelledby="review-heading">
      <header className="review-header">
        <div>
          <p className="eyebrow">Review Mode</p>
          <h2 id="review-heading">{CARD_LABELS[card.card_type]}</h2>
        </div>
        <span>{state.dueCards.length} 张到期</span>
      </header>

      <div className="review-prompt">
        <p>先口头作答，再揭示参考答案</p>
        <strong>{promptFor(card)}</strong>
      </div>

      {!revealed ? (
        <button
          className="button-primary reveal-button"
          type="button"
          onClick={() => setRevealed(true)}
        >
          揭示参考答案
        </button>
      ) : (
        <>
          <div className="review-answer">
            <p className="eyebrow">参考答案</p>
            {answerFor(card)
              .split("\n")
              .map((line) => (
                <p key={line}>{line}</p>
              ))}
          </div>
          <div className="rating-grid" aria-label="自评结果">
            {RATING_LABELS.map(({ rating, label }) => (
              <button
                type="button"
                key={rating}
                disabled={state.grading}
                onClick={() => void onGrade(card, rating)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {state.error ? (
        <p className="analysis-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
