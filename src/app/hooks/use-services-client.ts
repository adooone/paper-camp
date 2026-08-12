import type { ServiceState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
import { fetchServices, startService, stopService } from '../services/services-api';

export interface ServicesClient {
  services: ServiceState[];
  loading: boolean;
  start: (name: string) => Promise<void>;
  stop: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useServicesClient(): ServicesClient {
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setServices(await fetchServices());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    };
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.type === 'service' || payload.message === 'changed') schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  const start = useCallback(
    async (name: string) => {
      await startService(name);
      await refresh();
    },
    [refresh],
  );

  const stop = useCallback(
    async (name: string) => {
      await stopService(name);
      await refresh();
    },
    [refresh],
  );

  return { services, loading, start, stop, refresh };
}
