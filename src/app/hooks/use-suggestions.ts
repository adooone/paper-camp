import { fetchSuggestions } from '@/app/services/content';
import { suggestionsQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { SuggestionEntry } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseSuggestionsResult {
  suggestions: SuggestionEntry[];
  suggestionsLoading: boolean;
}

export function useSuggestions(): UseSuggestionsResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, isLoading } = useQuery({
    queryKey: suggestionsQueryKey(runtimeUrl),
    queryFn: async () => (await fetchSuggestions()).entries,
  });
  return { suggestions: data ?? [], suggestionsLoading: isLoading };
}
