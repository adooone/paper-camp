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
  isLoading: boolean;
  refreshing: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCapacity(): UseCapacityResult {
  const { runtimeUrl } = useRuntimeConnection();
  const {
    data,
    isLoading,
    error: fetchError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: capacityQueryKey(runtimeUrl),
    queryFn: fetchCapacity,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (fetchError) setError(fetchError as Error);
  }, [fetchError]);

  useEffect(() => {
    if (dataUpdatedAt > 0) setError(null);
  }, [dataUpdatedAt]);

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
        const probeError = err as Error;
        setError(probeError);
        toast({
          title: "Couldn't check capacity",
          description: probeError.message,
          variant: 'error',
        });
      })
      .finally(() => setRefreshing(false));
  }, [toast]);

  return { record: data ?? null, isLoading, refreshing, error, refresh };
}
