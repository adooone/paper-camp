import type { Notification, ParkedQuestion, StoredNotification } from '../types/index';

function ageInDays(date: string): number {
  return Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
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
