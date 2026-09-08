import type { DeskCheckState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
import { fetchChecks, fixDeskCheck, runChangedCheck, runDeskCheck } from '../services/checks-api';

export interface DeskChecksClient {
  checks: DeskCheckState[];
  run: (name: string) => Promise<void>;
  runChanged: (name: string) => Promise<void>;
  fix: (name: string) => Promise<DeskCheckState>;
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

  const runChanged = useCallback(
    async (name: string) => {
      await runChangedCheck(name);
      await refresh();
    },
    [refresh],
  );

  const fix = useCallback(
    async (name: string) => {
      const check = await fixDeskCheck(name);
      await refresh();
      return check;
    },
    [refresh],
  );

  return { checks, run, runChanged, fix };
}
