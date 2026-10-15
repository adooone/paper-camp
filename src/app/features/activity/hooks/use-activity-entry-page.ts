import { markRead } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { resolveLogRow } from '@/core/run-rows';
import type { LogRow } from '@/types/index';
import { useEffect, useRef } from 'react';
import { markReadIdFor } from '../helpers';
import { useLogRows } from './use-run-rows';

export const useActivityEntryPage = (entryId: string) => {
  const { loading, allRows, actions } = useLogRows();
  const setActiveLogEntryTitle = useAppStore((s) => s.setActiveLogEntryTitle);
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
    if (unreadMarkId) markRead(unreadMarkId);
  }, [unreadMarkId]);

  return { loading, row, actions };
};
