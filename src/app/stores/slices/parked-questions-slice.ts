import { fetchParkedQuestions } from '@/app/services/content';
import type { ParkedQuestion } from '@/types/index';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type ParkedQuestionsSlice = {
  parkedQuestions: ParkedQuestion[] | null;
  parkedQuestionsLoading: boolean;
  parkedQuestionsError: string | null;
  loadParkedQuestions: () => Promise<void>;
};

export function createParkedQuestionsSlice(set: SetState): ParkedQuestionsSlice {
  return {
    parkedQuestions: null,
    parkedQuestionsLoading: false,
    parkedQuestionsError: null,
    loadParkedQuestions: loadSlice(
      set,
      fetchParkedQuestions,
      (entries) => ({ parkedQuestions: entries, parkedQuestionsError: null }),
      (err) => ({ parkedQuestionsError: String(err) }),
      'parkedQuestionsLoading',
    ),
  };
}
