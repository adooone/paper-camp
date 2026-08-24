import { fetchTaskLogAt } from '@/app/services/content';
import { listRuntimes } from '@/app/services/runtime-connection';
import type { TaskLogEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { type ProjectContribution, fanOutRuntimes } from './fan-out';

export type ActivityRow = ProjectContribution<TaskLogEntry>;

export const OVERNIGHT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function useCrossProjectActivity(): { rows: ActivityRow[]; loading: boolean } {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const runtimes = listRuntimes(window.localStorage);
    const since = Date.now() - OVERNIGHT_WINDOW_MS;
    fanOutRuntimes(runtimes, fetchTaskLogAt).then((contributions) => {
      if (cancelled) return;
      const flattened = contributions
        .flatMap((c) => c.data.map((entry) => ({ runtime: c.runtime, data: entry })))
        .filter((row) => new Date(row.data.startedAt).getTime() >= since)
        .sort((a, b) => b.data.startedAt.localeCompare(a.data.startedAt));
      setRows(flattened);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading };
}
