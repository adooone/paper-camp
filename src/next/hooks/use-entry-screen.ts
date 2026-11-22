import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markRead } from '@/app/hooks/use-notifications';
import { useAppStore } from '@/app/stores/app-store';
import type { AgentTaskState, LogRow } from '@/types/index';
import { discussTarget, isLive, liveTaskFor } from '../shell/run-model';

export interface EntryScreenState {
  live: AgentTaskState | null;
  discussId: string | undefined;
  busy: string | null;
  error: string | null;
  stop: () => void;
  markRead: () => void;
}

const failure = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'Action failed.';

export function useEntryScreen(row: LogRow, reload: () => Promise<void>): EntryScreenState {
  const agentStatus = useAppStore((state) => state.agentStatus);
  const stopAgent = useAppStore((state) => state.stopAgent);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef<string | null>(null);

  const live = useMemo(() => liveTaskFor(row, agentStatus.filter(isLive)), [row, agentStatus]);

  const act = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key);
      setError(null);
      try {
        await action();
        await reload();
      } catch (cause) {
        setError(failure(cause));
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  const readId = row.source.kind === 'task' && row.unread ? row.source.entry.id : null;
  useEffect(() => {
    if (!readId || opened.current === readId) return;
    opened.current = readId;
    void markRead(readId).then(reload, () => {});
  }, [readId, reload]);

  return {
    live,
    discussId: discussTarget(row, live),
    busy,
    error,
    stop: () => {
      if (live) void act('stop', () => stopAgent(live.id));
    },
    markRead: () => {
      if (row.source.kind === 'reply') {
        const { id } = row.source.notification;
        void act('mark-read', () => markRead(id));
      }
    },
  };
}
