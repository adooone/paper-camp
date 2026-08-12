import type { CiReleaseState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    });
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [refresh]);

  return { ci, loading, refresh };
}
