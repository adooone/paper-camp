import { fetchIdeasAt } from '@/app/services/content';
import { listRuntimes } from '@/app/services/runtime-connection';
import type { IdeaEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { type ProjectContribution, fanOutRuntimes } from './fan-out';

export type IdeaRow = ProjectContribution<IdeaEntry>;

export function useCrossProjectIdeas(): { rows: IdeaRow[]; loading: boolean } {
  const [rows, setRows] = useState<IdeaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const runtimes = listRuntimes(window.localStorage);
    fanOutRuntimes(runtimes, fetchIdeasAt).then((contributions) => {
      if (cancelled) return;
      setRows(
        contributions.flatMap((c) =>
          c.data.entries.map((idea) => ({ runtime: c.runtime, data: idea })),
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
