import { fetchParkedQuestions } from '@/app/services/content';
import { parkedQuestionsQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { ParkedQuestion } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseParkedQuestionsResult {
  parkedQuestions: ParkedQuestion[] | null;
  parkedQuestionsLoading: boolean;
  parkedQuestionsError: string | null;
}

export function useParkedQuestions(): UseParkedQuestionsResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, isLoading, error } = useQuery({
    queryKey: parkedQuestionsQueryKey(runtimeUrl),
    queryFn: fetchParkedQuestions,
  });
  return {
    parkedQuestions: data ?? null,
    parkedQuestionsLoading: isLoading,
    parkedQuestionsError: error ? String(error) : null,
  };
}
