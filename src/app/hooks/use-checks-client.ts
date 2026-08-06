import { fetchConsistency } from '@/app/services/content';
import { type StatusState, fetchStatus } from '@/app/services/status-api';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import type { CheckStatus } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../services/api-base';

export interface ChecksClientState {
  qualityStatus: CheckStatus;
  testStatus: CheckStatus;
  consistencyStatus: CheckStatus;
  hasDocIssues: boolean;
}

// Read-only sibling of the desk's Stack panel check stamps (useAppStore-free,
// like the toolbar's other clients) — no run-check/fix-quality actions here.
export function useChecksClient(): ChecksClientState {
  const [status, setStatus] = useState<StatusState | null>(null);
  const [docIssueCount, setDocIssueCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch {}
    try {
      setDocIssueCount((await fetchConsistency()).length);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { message?: string; type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type !== 'status' && payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, payload.type === 'status' ? 80 : 250);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [load]);

  const { qualityStatus, testStatus, consistencyStatus } = deriveCheckStatuses(status);
  return { qualityStatus, testStatus, consistencyStatus, hasDocIssues: docIssueCount > 0 };
}
