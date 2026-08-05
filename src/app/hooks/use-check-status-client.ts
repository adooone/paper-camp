import { apiUrl } from '@/app/services/api-base';
import { fetchStatus } from '@/app/services/status-api';
import { type DerivedCheckStatuses, deriveCheckStatuses } from '@/app/utils/check-status';
import { useCallback, useEffect, useState } from 'react';

const IDLE_STATUSES: DerivedCheckStatuses = {
  qualityStatus: 'stale',
  testStatus: 'stale',
  consistencyStatus: 'stale',
};

export function useCheckStatusClient(): DerivedCheckStatuses {
  const [statuses, setStatuses] = useState<DerivedCheckStatuses>(IDLE_STATUSES);

  const load = useCallback(async () => {
    try {
      setStatuses(deriveCheckStatuses(await fetchStatus()));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type !== 'status') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 150);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [load]);

  return statuses;
}
