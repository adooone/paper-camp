import type { PlanEntry } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { subscribeToActivityStream } from '../services/activity-stream';
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  return focusPlan;
}
