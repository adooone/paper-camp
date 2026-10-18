import { ciQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { CiReleaseState } from '@/types/index';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchCiRelease } from '../services/ci-api';

export interface CiReleaseClient {
  ci: CiReleaseState | null;
  refresh: () => Promise<void>;
}

export function useCiRelease(): CiReleaseClient {
  const { runtimeUrl } = useRuntimeConnection();
  const queryClient = useQueryClient();
  const queryKey = ciQueryKey(runtimeUrl);

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchCiRelease(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const refresh = useCallback(async () => {
    queryClient.setQueryData(queryKey, await fetchCiRelease(true));
  }, [queryClient, queryKey]);

  return { ci: data ?? null, refresh };
}
