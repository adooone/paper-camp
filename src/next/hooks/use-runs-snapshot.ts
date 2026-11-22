import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useNotifications } from '@/app/hooks/use-notifications';
import { notificationsQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { useAppStore } from '@/app/stores/app-store';
import { buildLogRows } from '@/core/run-rows';
import type { LogRow } from '@/types/index';

export interface LogSnapshot {
  loading: boolean;
  failed: boolean;
  rows: LogRow[];
  unreadCount: number;
  reload: () => Promise<void>;
}

export function useLogSnapshot(): LogSnapshot {
  const { runtimeUrl } = useRuntimeConnection();
  const queryClient = useQueryClient();
  const taskLog = useAppStore((state) => state.taskLog);
  const taskLogLoading = useAppStore((state) => state.taskLogLoading);
  const agentStatus = useAppStore((state) => state.agentStatus);
  const loadTaskLog = useAppStore((state) => state.loadTaskLog);
  const loadAgentStatus = useAppStore((state) => state.loadAgentStatus);
  const { notifications, notificationsError } = useNotifications();
  const reload = useCallback(async () => {
    await Promise.all([
      loadTaskLog(),
      loadAgentStatus(),
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(runtimeUrl) }),
    ]);
  }, [loadTaskLog, loadAgentStatus, queryClient, runtimeUrl]);
  return useMemo(() => {
    const rows = buildLogRows(taskLog, [], agentStatus, notifications ?? []);
    return {
      loading: taskLogLoading || (notifications === null && notificationsError === null),
      failed: notifications === null && notificationsError !== null,
      rows,
      unreadCount: rows.filter((row) => row.unread).length,
      reload,
    };
  }, [taskLog, taskLogLoading, agentStatus, notifications, notificationsError, reload]);
}
