import {
  DEFAULT_NOTIFICATION_KINDS,
  type Notification,
  type NotificationSettingKind,
  type ParkedQuestion,
  type StoredNotification,
  type StoredNotificationKind,
} from '../types/index';

function ageInDays(date: string): number {
  return Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
}

export function notificationSettingKind(
  kind: StoredNotificationKind,
  outcome?: 'done' | 'error' | 'interrupted',
): NotificationSettingKind {
  if (kind === 'completed') {
    if (outcome === 'error') return 'run-failed';
    if (outcome === 'interrupted') return 'run-interrupted';
    return 'run-finished';
  }
  if (kind === 'reply') return 'reply-posted';
  return kind;
}

export function isNotificationKindEnabled(
  kinds: Partial<Record<NotificationSettingKind, boolean>> | undefined,
  settingKind: NotificationSettingKind,
): boolean {
  return kinds?.[settingKind] ?? DEFAULT_NOTIFICATION_KINDS[settingKind];
}

export function notificationAgeDays(notification: Notification): number {
  return notification.kind === 'question' ? notification.ageDays : ageInDays(notification.date);
}

/** Every parked question alongside completed/reply notifications, oldest-first — the
 * unified feed (IDEA-153) replacing the questions-only Inbox. */
export function mergeNotifications(
  parkedQuestions: ParkedQuestion[],
  stored: StoredNotification[],
): Notification[] {
  const entries: Notification[] = [
    ...parkedQuestions.map((q): Notification => ({ ...q, kind: 'question' })),
    ...stored,
  ];
  return entries.sort((a, b) => notificationAgeDays(b) - notificationAgeDays(a));
}
