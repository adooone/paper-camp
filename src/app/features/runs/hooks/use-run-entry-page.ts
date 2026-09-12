import { useAppStore } from '@/app/stores/app-store';
import { resolveLogRow } from '@/core/run-rows';
import { useEffect } from 'react';
import { markReadIdFor } from '../helpers';
import { useLogRows } from './use-run-rows';

export const useLogEntryPage = (entryId: string) => {
  const { loading, allRows, actions } = useLogRows();
  const markRead = useAppStore((s) => s.markRead);
  const setActiveLogEntryTitle = useAppStore((s) => s.setActiveLogEntryTitle);
  const row = resolveLogRow(allRows, entryId);
  const title = row?.title;
  const unreadMarkId = row ? markReadIdFor(row) : undefined;

  useEffect(() => {
    setActiveLogEntryTitle(title ?? null);
  }, [title, setActiveLogEntryTitle]);

  useEffect(() => {
    if (unreadMarkId) markRead(unreadMarkId);
  }, [unreadMarkId, markRead]);

  return { loading, row, actions };
};
