import type { PrReviewStatus } from '@/types/index';
import { useEffect, useState } from 'react';
import { fetchPrReviewStatus } from '../services/agent-api';

export function usePrReviewStatus(planId: string | undefined): PrReviewStatus | null {
  const [status, setStatus] = useState<PrReviewStatus | null>(null);

  useEffect(() => {
    if (!planId) {
      setStatus(null);
      return;
    }
    fetchPrReviewStatus(planId).then(setStatus);
  }, [planId]);

  return status;
}
