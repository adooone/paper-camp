import type { DeskCheckState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    };
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.type === 'check' || payload.message === 'changed') schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
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
