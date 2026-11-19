import { useQuery } from '@tanstack/react-query';
import { fetchIdeas } from '@/app/services/content';
import { ideasQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { IdeaEntry } from '@/types/index';

export function useIdeas(): IdeaEntry[] {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: ideasQueryKey(runtimeUrl),
    queryFn: async () => (await fetchIdeas()).entries,
  });
  return data ?? [];
}
