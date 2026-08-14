import type { PrReviewStatus } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
import { fetchPrReviewStatus } from '../services/agent-api';

export function usePrReviewStatus(planId: string | undefined): PrReviewStatus | null {
  const [status, setStatus] = useState<PrReviewStatus | null>(null);

  const refresh = useCallback(async () => {
    setStatus(planId ? await fetchPrReviewStatus(planId) : null);
  }, [planId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  return status;
}
