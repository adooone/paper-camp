import { fetchNotifications, markNotificationRead } from '@/app/services/content';
import { notificationsQueryKey, queryClient } from '@/app/services/query-client';
import { getRuntimeConnection, useRuntimeConnection } from '@/app/services/runtime-connection';
import type { Notification } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseNotificationsResult {
  notifications: Notification[] | null;
  notificationsLoading: boolean;
  notificationsError: string | null;
}

export function useNotifications(): UseNotificationsResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, isLoading, error } = useQuery({
    queryKey: notificationsQueryKey(runtimeUrl),
    queryFn: fetchNotifications,
  });
  return {
    notifications: data ?? null,
    notificationsLoading: isLoading,
    notificationsError: error ? String(error) : null,
  };
}

export async function markRead(id: string): Promise<void> {
  const key = notificationsQueryKey(getRuntimeConnection().runtimeUrl);
  const previous = queryClient.getQueryData<Notification[]>(key);
  if (previous) {
    queryClient.setQueryData<Notification[]>(
      key,
      previous.map((n) => (n.kind !== 'question' && n.id === id ? { ...n, read: true } : n)),
    );
  }
  try {
    await markNotificationRead(id);
  } catch {
    if (previous) queryClient.setQueryData(key, previous);
  }
}
