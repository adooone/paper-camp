import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { capacityQueryKey, refreshCapacity } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchCapacity, probeCapacity } from '@/app/services/system/capacity-api';
import type { CapacityRecord } from '@/core/capacity';
import { useToast } from '@dendelion/folk-ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

export interface UseCapacityResult {
  record: CapacityRecord | null;
  refreshing: boolean;
  refresh: () => void;
}

export function useCapacity(): UseCapacityResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: capacityQueryKey(runtimeUrl),
    queryFn: fetchCapacity,
  });
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return subscribeToActivityStream((payload) => {
      if (payload.type === 'capacity') void refreshCapacity();
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    probeCapacity()
      .then(() => refreshCapacity())
      .catch((err) => {
        toast({
          title: "Couldn't check capacity",
          description: (err as Error).message,
          variant: 'error',
        });
      })
      .finally(() => setRefreshing(false));
  }, [toast]);

  return { record: data ?? null, refreshing, refresh };
}
