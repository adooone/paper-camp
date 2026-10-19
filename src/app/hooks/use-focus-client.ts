import type { PlanEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { fetchPlans } from '../services/content';

export function useFocusClient(): PlanEntry | null {
  const [focusPlan, setFocusPlan] = useState<PlanEntry | null>(null);

  useEffect(() => {
    fetchPlans()
      .then(({ entries }) => setFocusPlan(findFocusPlan(entries) ?? null))
      .catch(() => {});
  }, []);

  return focusPlan;
}
