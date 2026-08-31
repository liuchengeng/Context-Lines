import {
  ReviewCardUpdateSchema,
  type ReviewCard,
  type ReviewCardUpdate,
  type ReviewRating,
} from "@contextlines/contracts";
import { Rating, State, fsrs, type Card, type Grade } from "ts-fsrs";

const scheduler = fsrs({ enable_fuzz: false });

const ratings: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toFsrsCard(card: ReviewCard): Card {
  return {
    due: new Date(card.due_at),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    ...(card.last_review_at
      ? { last_review: new Date(card.last_review_at) }
      : {}),
  };
}

function serializableCard(card: Card) {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString() ?? null,
  };
}

export interface ReviewTransition {
  numericRating: Grade;
  update: ReviewCardUpdate;
  before: ReturnType<typeof serializableCard>;
  after: ReturnType<typeof serializableCard>;
}

export function scheduleReview(
  card: ReviewCard,
  rating: ReviewRating,
  now = new Date(),
): ReviewTransition {
  const beforeCard = toFsrsCard(card);
  const result = scheduler.next(beforeCard, now, ratings[rating]);
  const update = ReviewCardUpdateSchema.parse({
    due_at: result.card.due.toISOString(),
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsed_days: result.card.elapsed_days,
    scheduled_days: result.card.scheduled_days,
    learning_steps: result.card.learning_steps,
    reps: result.card.reps,
    lapses: result.card.lapses,
    state: result.card.state,
    last_review_at: result.card.last_review?.toISOString() ?? now.toISOString(),
  });
  return {
    numericRating: ratings[rating],
    update,
    before: serializableCard(beforeCard),
    after: serializableCard(result.card),
  };
}
