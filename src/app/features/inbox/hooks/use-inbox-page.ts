import { useOpenEntity } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useEffect, useState } from 'react';

export const useInboxPage = () => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const notifications = useAppStore((s) => s.notifications);
  const loadFailed = useAppStore((s) => s.notificationsError !== null);
  const plans = useAppStore((s) => s.plans);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const markRead = useAppStore((s) => s.markRead);
  const openEntity = useOpenEntity();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notifications) return;
    for (const n of notifications) {
      if (n.kind !== 'question' && !n.read) markRead(n.id);
    }
  }, [notifications, markRead]);

  const reload = async () => {
    await Promise.all([loadPlans(), loadNotifications()]);
  };

  return {
    notifications,
    loadFailed,
    plans,
    expandedKey,
    setExpandedKey,
    openEntity,
    reload,
  };
};
