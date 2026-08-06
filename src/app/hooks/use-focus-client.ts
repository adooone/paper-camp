import type { PlanEntry } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { apiUrl } from '../services/api-base';
import { fetchPlans } from '../services/content';

export function useFocusClient(): PlanEntry | null {
  const [focusPlan, setFocusPlan] = useState<PlanEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const { entries } = await fetchPlans();
      setFocusPlan(findFocusPlan(entries) ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { message?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [load]);

  return focusPlan;
}
