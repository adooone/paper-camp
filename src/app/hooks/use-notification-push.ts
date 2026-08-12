import { useEffect, useRef } from 'react';
import { apiUrl } from '../services/api-base';
import { useAppStore } from '../stores/app-store';
import { newlyArrived, pushableNotifications } from './notification-push';

// Tab-open-but-unfocused only (IDEA-153) — no service worker, no closed-tab delivery.
export function useNotificationPush(): void {
  const notifications = useAppStore((s) => s.notifications);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!notifications) return;
    const fresh = pushableNotifications(notifications);
    const arrived = newlyArrived(fresh, seenIds.current);
    seenIds.current = new Set(fresh.map((n) => n.id));
    if (arrived.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;
    for (const n of arrived) new Notification(n.entityTitle, { body: n.text });
  }, [notifications]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { message?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadNotifications, 250);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [loadNotifications]);
}
