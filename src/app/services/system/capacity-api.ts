import { apiFetch, apiUrl } from '@/app/services/api-base';
import type { CapacityRecord } from '@/core/capacity';

// Generous: the probe spawns the CLI and waits for its first stream line.
const PROBE_TIMEOUT_MS = 30_000;

export const fetchCapacity = async (): Promise<CapacityRecord | null> => {
  const response = await apiFetch(apiUrl('/api/capacity'));
  if (!response.ok) return null;
  return (await response.json()) as CapacityRecord | null;
};

export const probeCapacity = async (): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/capacity/refresh'), {
    method: 'POST',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: 'Capacity probe failed' }));
  throw new Error(body.error ?? 'Capacity probe failed');
};
