import type { CapacityStat, RateLimitSnapshot, TaskLogEntry } from '../types/index';

export type CapacityLevel = 'allowed' | 'warning' | 'rejected';

export function capacityLevel(status: string): CapacityLevel {
  if (status === 'allowed') return 'allowed';
  if (/reject|block|exceed|denied/i.test(status)) return 'rejected';
  return 'warning';
}

export function resetsAtMs(resetsAt: number): number {
  return resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
}

export function latestCapacity(entries: TaskLogEntry[]): CapacityStat | null {
  let latest: CapacityStat | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    if (!entry.rateLimit) continue;
    if (
      entry.rateLimit.resetsAt !== undefined &&
      resetsAtMs(entry.rateLimit.resetsAt) <= Date.now()
    )
      continue;
    const at = Date.parse(entry.endedAt);
    if (Number.isNaN(at)) continue;
    if (at >= latestMs) {
      latestMs = at;
      latest = { snapshot: entry.rateLimit, capturedAt: entry.endedAt };
    }
  }
  return latest;
}

export interface EffectiveCapacity {
  snapshot: RateLimitSnapshot;
  /** Null when the reading came from a run still in flight — it is current by definition. */
  capturedAt: string | null;
}

export function mergeLiveCapacity(
  live: RateLimitSnapshot | null,
  stat: CapacityStat | null,
): EffectiveCapacity | null {
  if (live) return { snapshot: live, capturedAt: null };
  return stat ? { snapshot: stat.snapshot, capturedAt: stat.capturedAt } : null;
}
