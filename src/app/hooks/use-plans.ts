import { useQuery } from '@tanstack/react-query';
import { fetchPlans } from '@/app/services/content';
import { plansQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { ParseResult, PlanEntry } from '@/types/index';

export interface UsePlansResult {
  plans: ParseResult<PlanEntry> | null;
  plansError: string | null;
}

export function usePlans(): UsePlansResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, error } = useQuery({
    queryKey: plansQueryKey(runtimeUrl),
    queryFn: fetchPlans,
  });
  return { plans: data ?? null, plansError: error ? String(error) : null };
}
