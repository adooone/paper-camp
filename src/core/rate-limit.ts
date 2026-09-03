import type {
  CapacityStat,
  RateLimitSnapshot,
  RunUsage,
  TaskLogEntry,
  WindowSpend,
} from '../types/index';

export type CapacityLevel = 'allowed' | 'warning' | 'rejected';

export function capacityLevel(status: string): CapacityLevel {
  if (status === 'allowed') return 'allowed';
  if (/reject|block|exceed|denied/i.test(status)) return 'rejected';
  return 'warning';
}

export function resetsAtMs(resetsAt: number): number {
  return resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
}

function entryUsageTotals(entry: TaskLogEntry): WindowSpend {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  const add = (usage: RunUsage) => {
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    costUsd += usage.costUsd;
  };
  if (entry.phaseRuns?.length) for (const p of entry.phaseRuns) add(p.usage);
  else if (entry.usage) add(entry.usage);
  return { inputTokens, outputTokens, costUsd };
}

// No window duration is ever reported, so "opened" is the earliest run carrying the
// same resetsAt as the latest snapshot — the oldest evidence this window was active.
function windowStartMs(entries: TaskLogEntry[], latest: TaskLogEntry): number {
  const resetsAt = latest.rateLimit?.resetsAt;
  let start = Date.parse(latest.startedAt);
  if (resetsAt === undefined) return start;
  for (const entry of entries) {
    if (entry.rateLimit?.resetsAt !== resetsAt) continue;
    const at = Date.parse(entry.startedAt);
    if (!Number.isNaN(at) && at < start) start = at;
  }
  return start;
}

function sumWindowSpend(entries: TaskLogEntry[], latest: TaskLogEntry): WindowSpend {
  const startMs = windowStartMs(entries, latest);
  const totals: WindowSpend = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (const entry of entries) {
    const at = Date.parse(entry.startedAt);
    if (Number.isNaN(at) || at < startMs) continue;
    const usage = entryUsageTotals(entry);
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.costUsd += usage.costUsd;
  }
  return totals;
}

export function latestCapacity(entries: TaskLogEntry[]): CapacityStat | null {
  let latest: Omit<CapacityStat, 'windowSpend' | 'windowStartedAt'> | null = null;
  let latestEntry: TaskLogEntry | null = null;
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
      latestEntry = entry;
    }
  }
  if (!latest || !latestEntry) return null;
  return {
    ...latest,
    windowSpend: sumWindowSpend(entries, latestEntry),
    windowStartedAt: new Date(windowStartMs(entries, latestEntry)).toISOString(),
  };
}

export interface EffectiveCapacity {
  snapshot: RateLimitSnapshot;
  windowSpend: WindowSpend | null;
  windowStartedAt: string | null;
}

export function mergeLiveCapacity(
  live: RateLimitSnapshot | null,
  stat: CapacityStat | null,
): EffectiveCapacity | null {
  const snapshot = live ?? stat?.snapshot ?? null;
  if (!snapshot) return null;
  const sameWindow = stat !== null && stat.snapshot.resetsAt === snapshot.resetsAt;
  return {
    snapshot,
    windowSpend: sameWindow ? stat.windowSpend : null,
    windowStartedAt: sameWindow ? stat.windowStartedAt : null,
  };
}
