import { fetchNotifications, markNotificationRead } from '@/app/services/content';
import type { Notification } from '@/types/index';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type NotificationsSlice = {
  notifications: Notification[] | null;
  notificationsLoading: boolean;
  notificationsError: string | null;
  loadNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

export function createNotificationsSlice(set: SetState, get: GetState): NotificationsSlice {
  return {
    notifications: null,
    notificationsLoading: false,
    notificationsError: null,
    loadNotifications: loadSlice(
      set,
      fetchNotifications,
      (entries) => ({ notifications: entries, notificationsError: null }),
      (err) => ({ notificationsError: String(err) }),
      'notificationsLoading',
    ),
    markRead: async (id) => {
      const current = get().notifications;
      if (!current) return;
      set({
        notifications: current.map((n) =>
          n.kind !== 'question' && n.id === id ? { ...n, read: true } : n,
        ),
      });
      try {
        await markNotificationRead(id);
      } catch (err) {
        set({ notifications: current, notificationsError: String(err) });
      }
    },
  };
}
