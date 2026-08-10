import type { DeskCheckState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../services/api-base';
import { fetchChecks, runDeskCheck } from '../services/checks-api';

export interface DeskChecksClient {
  checks: DeskCheckState[];
  run: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDeskChecks(): DeskChecksClient {
  const [checks, setChecks] = useState<DeskCheckState[]>([]);

  const refresh = useCallback(async () => {
    try {
      setChecks(await fetchChecks());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    };
    source.onmessage = (event) => {
      let payload: { message?: string; type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === 'check' || payload.message === 'changed') schedule();
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [refresh]);

  const run = useCallback(
    async (name: string) => {
      await runDeskCheck(name);
      await refresh();
    },
    [refresh],
  );

  return { checks, run, refresh };
}
