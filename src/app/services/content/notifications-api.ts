import { apiUrl } from '@/app/services/api-base';
import type { Notification } from '@/types/index';

export const fetchNotifications = async () => {
  const res = await fetch(apiUrl('/api/notifications'));
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json() as Promise<Notification[]>;
};

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl` — mirrors `fetchPackageNameAt`.
export const fetchNotificationsAt = async (baseUrl: string): Promise<Notification[] | null> => {
  try {
    const res = await fetch(`${baseUrl}/api/notifications`);
    if (!res.ok) return null;
    return (await res.json()) as Notification[];
  } catch {
    return null;
  }
};

export const markNotificationRead = async (id: string) => {
  const res = await fetch(apiUrl('/api/notifications/mark-read'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Failed to mark notification read: ${res.status}`);
};

export const markNotificationReadAt = async (baseUrl: string, id: string): Promise<void> => {
  await fetch(`${baseUrl}/api/notifications/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
};
