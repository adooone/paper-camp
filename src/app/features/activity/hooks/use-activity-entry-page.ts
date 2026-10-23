import { markRead } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { resolveLogRow } from '@/core/run-rows';
import type { LogRow } from '@/types/index';
import { useToast } from '@dendelion/folk-ui';
import { useEffect, useRef } from 'react';
import { markReadIdFor, markReadOrToast } from '../helpers';
import { useLogRows } from './use-run-rows';

export const useActivityEntryPage = (entryId: string) => {
  const { loading, allRows, actions } = useLogRows();
  const setActiveLogEntryTitle = useAppStore((s) => s.setActiveLogEntryTitle);
  const { toast } = useToast();
  // A run that just finished drops out of the agent status a beat before its tasks.log
  // row loads; holding the last row keeps the page from flashing "doesn't exist".
  const lastRow = useRef<{ entryId: string; row: LogRow } | null>(null);
  const resolved = resolveLogRow(allRows, entryId);
  if (resolved) lastRow.current = { entryId, row: resolved };
  const row = resolved ?? (lastRow.current?.entryId === entryId ? lastRow.current.row : undefined);
  const title = row?.title;
  const unreadMarkId = row ? markReadIdFor(row) : undefined;

  useEffect(() => {
    setActiveLogEntryTitle(title ?? null);
  }, [title, setActiveLogEntryTitle]);

  useEffect(() => {
    if (unreadMarkId) {
      markReadOrToast(unreadMarkId, markRead, () =>
        toast({ title: 'Failed to mark read', variant: 'error' }),
      );
    }
  }, [unreadMarkId, toast]);

  return { loading, row, actions };
};
