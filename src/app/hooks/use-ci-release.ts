import type { CiReleaseState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { fetchCiRelease } from '../services/ci-api';

export interface CiReleaseClient {
  ci: CiReleaseState | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useCiRelease(): CiReleaseClient {
  const [ci, setCi] = useState<CiReleaseState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCi(await fetchCiRelease());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ci, loading, refresh };
}
