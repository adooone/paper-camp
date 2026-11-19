import { useQuery } from '@tanstack/react-query';
import { fetchNightReport } from '@/app/services/content';
import { nightReportQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { NightReportGroup } from '@/types/index';

export function useNightReport(): NightReportGroup[] {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: nightReportQueryKey(runtimeUrl),
    queryFn: async () => (await fetchNightReport()).groups,
  });
  return data ?? [];
}
