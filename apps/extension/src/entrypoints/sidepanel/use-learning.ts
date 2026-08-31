import {
  SaveExpressionInputSchema,
  type ReviewCard,
  type ReviewRating,
  type SaveExpressionInput,
} from "@contextlines/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createLearningRepository } from "../../lib/learning-repository";
import { scheduleReview } from "../../lib/review-scheduler";

const useMocks = import.meta.env.WXT_PUBLIC_USE_MOCKS === "true";

export interface LearningState {
  dueCards: ReviewCard[];
  loading: boolean;
  saving: boolean;
  grading: boolean;
  message: string | null;
  error: string | null;
}

const INITIAL_STATE: LearningState = {
  dueCards: [],
  loading: false,
  saving: false,
  grading: false,
  message: null,
  error: null,
};

export function useLearning(authenticated: boolean) {
  const repository = useMemo(() => createLearningRepository(useMocks), []);
  const [state, setState] = useState<LearningState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setState(INITIAL_STATE);
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const dueCards = await repository.listDueCards(new Date());
      setState((current) => ({ ...current, dueCards, loading: false }));
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "无法加载复习卡。",
      }));
    }
  }, [authenticated, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveExpression = useCallback(
    async (rawInput: SaveExpressionInput) => {
      if (!authenticated) throw new Error("请先登录再收藏表达。");
      const input = SaveExpressionInputSchema.parse(rawInput);
      setState((current) => ({
        ...current,
        saving: true,
        message: null,
        error: null,
      }));
      try {
        await repository.saveExpression(input);
        const dueCards = await repository.listDueCards(new Date());
        setState((current) => ({
          ...current,
          dueCards,
          saving: false,
          message: "已收藏，并创建 3 张复习卡。",
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "收藏表达失败。";
        setState((current) => ({
          ...current,
          saving: false,
          error: message,
        }));
        throw error;
      }
    },
    [authenticated, repository],
  );

  const grade = useCallback(
    async (card: ReviewCard, rating: ReviewRating) => {
      const transition = scheduleReview(card, rating);
      setState((current) => ({
        ...current,
        grading: true,
        message: null,
        error: null,
      }));
      try {
        await repository.recordReview(card, rating, transition);
        const dueCards = await repository.listDueCards(new Date());
        setState((current) => ({
          ...current,
          dueCards,
          grading: false,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          grading: false,
          error: error instanceof Error ? error.message : "记录复习结果失败。",
        }));
      }
    },
    [repository],
  );

  return { state, refresh, saveExpression, grade };
}
