import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { refreshNotifications } from '@/app/services/query-client';
import { useEffect } from 'react';

export function useNotificationPush(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refreshNotifications, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
