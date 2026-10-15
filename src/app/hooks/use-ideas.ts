import { fetchIdeas } from '@/app/services/content';
import { ideasQueryKey } from '@/app/services/query-client';
import { runtimeConnection } from '@/app/services/runtime-connection';
import type { IdeaEntry } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export function useIdeas(): IdeaEntry[] {
  const { data } = useQuery({
    queryKey: ideasQueryKey(runtimeConnection.runtimeUrl),
    queryFn: async () => (await fetchIdeas()).entries,
  });
  return data ?? [];
}
