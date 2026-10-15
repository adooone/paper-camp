import { fetchIdeas } from '@/app/services/content';
import { ideasQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { IdeaEntry } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export function useIdeas(): IdeaEntry[] {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: ideasQueryKey(runtimeUrl),
    queryFn: async () => (await fetchIdeas()).entries,
  });
  return data ?? [];
}
