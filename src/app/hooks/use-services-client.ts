import { refreshServices, servicesQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { ServiceState } from '@/types/index';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
import { fetchServices, restartService, startService, stopService } from '../services/services-api';

export interface ServicesClient {
  services: ServiceState[];
  start: (name: string) => Promise<void>;
  stop: (name: string) => Promise<void>;
  restart: (name: string) => Promise<void>;
}

async function start(name: string): Promise<void> {
  await startService(name);
  await refreshServices();
}

async function stop(name: string): Promise<void> {
  await stopService(name);
  await refreshServices();
}

async function restart(name: string): Promise<void> {
  await restartService(name);
  await refreshServices();
}

export function useServicesClient(): ServicesClient {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: servicesQueryKey(runtimeUrl),
    queryFn: fetchServices,
  });

  useEffect(() => {
    return subscribeToActivityStream((payload) => {
      if (payload.type === 'service') void refreshServices();
    });
  }, []);

  return { services: data ?? [], start, stop, restart };
}
