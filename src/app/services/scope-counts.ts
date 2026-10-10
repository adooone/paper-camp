import type { Notification } from '@/types/index';
import { fetchNotifications, fetchNotificationsAt } from './content/notifications-api';
import { fetchStats, fetchStatsAt } from './content/stats-api';

function unreadNotificationCount(notifications: Notification[]): number {
  return notifications.filter((n) => n.kind === 'question' || !n.read).length;
}

export async function openIdeasCount(
  runtimeUrl: string,
  isCurrent: boolean,
): Promise<number | null> {
  try {
    const stats = isCurrent ? await fetchStats() : await fetchStatsAt(runtimeUrl);
    return stats ? (stats.entitiesByStatus.open ?? 0) : null;
  } catch {
    return null;
  }
}

export async function unreadActivityCount(
  runtimeUrl: string,
  isCurrent: boolean,
): Promise<number | null> {
  try {
    const notifications = isCurrent
      ? await fetchNotifications()
      : await fetchNotificationsAt(runtimeUrl);
    return notifications ? unreadNotificationCount(notifications) : null;
  } catch {
    return null;
  }
}
