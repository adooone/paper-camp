import type { Notification, StoredNotification } from '@/types/index';

export function pushableNotifications(notifications: Notification[]): StoredNotification[] {
  return notifications.filter((n): n is StoredNotification => n.kind !== 'question');
}

// null `seen` means this is the first snapshot since mount — nothing to diff against yet,
// so nothing counts as newly arrived (no backlog push on load).
export function newlyArrived(
  current: StoredNotification[],
  seen: Set<string> | null,
): StoredNotification[] {
  if (!seen) return [];
  return current.filter((n) => !seen.has(n.id));
}
