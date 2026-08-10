import type { CiReleaseState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../services/api-base';
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
      timer = setTimeout(refresh, 250);
    };
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      source.close();
    };
  }, [refresh]);

  return { ci, loading, refresh };
}
