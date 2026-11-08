import { fetchWorklist } from '@/app/services/content';
import { worklistQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { WorklistEntry } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseWorklistResult {
  worklist: WorklistEntry[] | null;
  worklistError: string | null;
}

export function useWorklist(): UseWorklistResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, error } = useQuery({
    queryKey: worklistQueryKey(runtimeUrl),
    queryFn: fetchWorklist,
  });
  return { worklist: data ?? null, worklistError: error ? String(error) : null };
}
