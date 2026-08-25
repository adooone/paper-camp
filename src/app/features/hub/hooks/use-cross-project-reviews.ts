import { fetchPlansAt } from '@/app/services/content';
import { listRuntimes } from '@/app/services/runtime-connection';
import type { PlanEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { type ProjectContribution, fanOutRuntimes } from '../helpers';

export type ReviewRow = ProjectContribution<PlanEntry & { id: string }>;

export function useCrossProjectReviews(): { rows: ReviewRow[]; loading: boolean } {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const runtimes = listRuntimes(window.localStorage);
    fanOutRuntimes(runtimes, fetchPlansAt).then((contributions) => {
      if (cancelled) return;
      setRows(
        contributions.flatMap((c) =>
          c.data.entries
            .filter(
              (plan): plan is PlanEntry & { id: string } => plan.status === 'review' && !!plan.id,
            )
            .map((plan) => ({ runtime: c.runtime, data: plan })),
        ),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading };
}
