import { apiUrl } from '@/app/services/api-base';
import type { Notification } from '@/types/index';

export const fetchNotifications = async () => {
  const res = await fetch(apiUrl('/api/notifications'));
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json() as Promise<Notification[]>;
};

export const markNotificationRead = async (id: string) => {
  const res = await fetch(apiUrl('/api/notifications/mark-read'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
};
