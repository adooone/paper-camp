import { apiUrl } from '@/app/services/api-base';
import type { CapacityStat } from '@/types/index';

// Generous: the probe spawns the CLI and waits for its first stream line.
const PROBE_TIMEOUT_MS = 30_000;

export const refreshCapacityProbe = async (): Promise<CapacityStat | null> => {
  const response = await fetch(apiUrl('/api/capacity/refresh'), {
    method: 'POST',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Partial<CapacityStat>;
  return body.snapshot && body.capturedAt
    ? { snapshot: body.snapshot, capturedAt: body.capturedAt }
    : null;
};
