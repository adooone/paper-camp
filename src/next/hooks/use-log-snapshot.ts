import { useMemo } from 'react';
import { useNotifications } from '@/app/hooks/use-notifications';
import { useAppStore } from '@/app/stores/app-store';
import { buildLogRows } from '@/core/run-rows';
import type { LogRow } from '@/types/index';

export interface LogSnapshot {
  loading: boolean;
  rows: LogRow[];
  unreadCount: number;
}

export function useLogSnapshot(): LogSnapshot {
  const taskLog = useAppStore((state) => state.taskLog);
  const taskLogLoading = useAppStore((state) => state.taskLogLoading);
  const agentStatus = useAppStore((state) => state.agentStatus);
  const { notifications } = useNotifications();
  return useMemo(() => {
    const rows = buildLogRows(taskLog, [], agentStatus, notifications ?? []);
    return {
      loading: taskLogLoading || notifications === null,
      rows,
      unreadCount: rows.filter((row) => row.unread).length,
    };
  }, [taskLog, taskLogLoading, agentStatus, notifications]);
}
