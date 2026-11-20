import { useEffect } from 'react';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useAppStore } from '@/app/stores/app-store';

const REFRESH_DELAY_MS = 120;

export function useAgentStatusStream(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.type !== 'agent') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => useAppStore.getState().loadAgentStatus(), REFRESH_DELAY_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
