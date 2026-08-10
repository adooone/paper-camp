import type { ServiceState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../services/api-base';
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
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    };
    source.onmessage = (event) => {
      let payload: { message?: string; type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === 'service' || payload.message === 'changed') schedule();
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
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
