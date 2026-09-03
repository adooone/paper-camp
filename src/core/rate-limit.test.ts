import { describe, expect, it } from 'vitest';
import type { CapacityStat, RateLimitSnapshot, RunUsage, TaskLogEntry } from '../types/index';
import { capacityLevel, latestCapacity, mergeLiveCapacity, resetsAtMs } from './rate-limit';

describe('capacityLevel', () => {
  it('treats only an exact "allowed" as the safe level', () => {
    expect(capacityLevel('allowed')).toBe('allowed');
    expect(capacityLevel('allowed_warning')).toBe('warning');
    expect(capacityLevel('warning')).toBe('warning');
  });

  it('classifies rejection-flavoured statuses as rejected', () => {
    expect(capacityLevel('rejected')).toBe('rejected');
    expect(capacityLevel('blocked')).toBe('rejected');
    expect(capacityLevel('exceeded')).toBe('rejected');
  });
});

describe('resetsAtMs', () => {
  it('scales second-granularity timestamps to milliseconds', () => {
    expect(resetsAtMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it('passes millisecond timestamps through untouched', () => {
    expect(resetsAtMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
});

function usage(overrides: Partial<RunUsage> = {}): RunUsage {
  return {
    durationMs: 0,
    numTurns: 1,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    ...overrides,
  };
}

function logEntry(overrides: Partial<TaskLogEntry>): TaskLogEntry {
  return {
    id: 'x',
    taskKind: 'phase',
    planTitle: 'Plan',
    agentId: 'claude-code',
    startedAt: '2026-07-27T10:00:00Z',
    endedAt: '2026-07-27T10:05:00Z',
    outcome: 'done',
    ...overrides,
  };
}

describe('latestCapacity', () => {
  // Seconds, well past any real clock without being a moving target.
  const FUTURE_RESETS_AT = 4_000_000_000;
  const PAST_RESETS_AT = 1_700_000_000;

  it('returns the rate-limit snapshot from the most recently ended run that carried one', () => {
    const entries: TaskLogEntry[] = [
      logEntry({
        endedAt: '2026-08-01T10:00:00Z',
        rateLimit: { status: 'allowed' },
      }),
      logEntry({
        endedAt: '2026-08-03T10:00:00Z',
        rateLimit: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
      }),
      logEntry({ endedAt: '2026-08-04T10:00:00Z' }),
    ];
    expect(latestCapacity(entries)).toEqual({
      snapshot: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
      capturedAt: '2026-08-03T10:00:00Z',
      windowSpend: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      windowStartedAt: '2026-07-27T10:00:00.000Z',
    });
  });

  it('ignores a capacity record with an unparseable endedAt', () => {
    const entries: TaskLogEntry[] = [
      logEntry({ endedAt: 'not-a-date', rateLimit: { status: 'rejected' } }),
      logEntry({ endedAt: '2026-08-01T10:00:00Z', rateLimit: { status: 'allowed' } }),
    ];
    expect(latestCapacity(entries)).toEqual({
      snapshot: { status: 'allowed' },
      capturedAt: '2026-08-01T10:00:00Z',
      windowSpend: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      windowStartedAt: '2026-07-27T10:00:00.000Z',
    });
  });

  it('returns null when no run reported capacity', () => {
    expect(latestCapacity([logEntry({})])).toBeNull();
  });

  it('treats a snapshot whose resetsAt has passed as unknown, falling back to an earlier current one', () => {
    const entries: TaskLogEntry[] = [
      logEntry({
        endedAt: '2026-08-01T10:00:00Z',
        rateLimit: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
      }),
      logEntry({
        endedAt: '2026-08-03T10:00:00Z',
        rateLimit: { status: 'rejected', resetsAt: PAST_RESETS_AT },
      }),
    ];
    expect(latestCapacity(entries)).toEqual({
      snapshot: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
      capturedAt: '2026-08-01T10:00:00Z',
      windowSpend: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      windowStartedAt: '2026-07-27T10:00:00.000Z',
    });
  });

  it('returns null when the only snapshot on record has expired', () => {
    const entries: TaskLogEntry[] = [
      logEntry({
        endedAt: '2026-08-01T10:00:00Z',
        rateLimit: { status: 'rejected', resetsAt: PAST_RESETS_AT },
      }),
    ];
    expect(latestCapacity(entries)).toBeNull();
  });

  it('keeps a snapshot with no resetsAt as current regardless of age', () => {
    const entries: TaskLogEntry[] = [
      logEntry({ endedAt: '2020-01-01T10:00:00Z', rateLimit: { status: 'allowed' } }),
    ];
    expect(latestCapacity(entries)).toEqual({
      snapshot: { status: 'allowed' },
      capturedAt: '2020-01-01T10:00:00Z',
      windowSpend: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      windowStartedAt: '2026-07-27T10:00:00.000Z',
    });
  });

  it('sums tokens and cost across every run since the earliest one sharing the same resetsAt', () => {
    const entries: TaskLogEntry[] = [
      // Outside the window: an older run under a different (already-passed) reset.
      logEntry({
        startedAt: '2026-07-30T09:00:00Z',
        endedAt: '2026-07-30T09:05:00Z',
        rateLimit: { status: 'allowed', resetsAt: PAST_RESETS_AT },
        usage: usage({ inputTokens: 9999, outputTokens: 9999, costUsd: 99 }),
      }),
      logEntry({
        startedAt: '2026-08-01T09:00:00Z',
        endedAt: '2026-08-01T09:05:00Z',
        rateLimit: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
        usage: usage({ inputTokens: 100, outputTokens: 10, costUsd: 0.1 }),
      }),
      logEntry({
        startedAt: '2026-08-02T09:00:00Z',
        endedAt: '2026-08-02T09:05:00Z',
        usage: usage({ inputTokens: 200, outputTokens: 20, costUsd: 0.2 }),
      }),
      logEntry({
        startedAt: '2026-08-03T09:00:00Z',
        endedAt: '2026-08-03T09:05:00Z',
        rateLimit: { status: 'allowed_warning', resetsAt: FUTURE_RESETS_AT },
        usage: usage({ inputTokens: 300, outputTokens: 30, costUsd: 0.3 }),
      }),
    ];
    const windowSpend = latestCapacity(entries)?.windowSpend;
    expect(windowSpend).toMatchObject({ inputTokens: 600, outputTokens: 60 });
    expect(windowSpend?.costUsd).toBeCloseTo(0.6);
  });
});

describe('mergeLiveCapacity', () => {
  const stat: CapacityStat = {
    snapshot: { status: 'allowed_warning', resetsAt: 4_000_000_000 },
    capturedAt: '2026-08-01T10:00:00Z',
    windowSpend: { inputTokens: 100, outputTokens: 10, costUsd: 0.1 },
    windowStartedAt: '2026-07-27T10:00:00.000Z',
  };

  it('returns null when neither the live task nor the log has ever reported capacity', () => {
    expect(mergeLiveCapacity(null, null)).toBeNull();
  });

  it('falls back to the logged snapshot when no task is in flight', () => {
    expect(mergeLiveCapacity(null, stat)).toEqual({
      snapshot: stat.snapshot,
      windowSpend: stat.windowSpend,
      windowStartedAt: stat.windowStartedAt,
    });
  });

  it('prefers the in-flight snapshot, keeping the logged window spend when the window matches', () => {
    const live: RateLimitSnapshot = { status: 'rejected', resetsAt: stat.snapshot.resetsAt };
    expect(mergeLiveCapacity(live, stat)).toEqual({
      snapshot: live,
      windowSpend: stat.windowSpend,
      windowStartedAt: stat.windowStartedAt,
    });
  });

  it('drops the logged window spend when the in-flight snapshot belongs to a newer window', () => {
    const live: RateLimitSnapshot = { status: 'allowed', resetsAt: 5_000_000_000 };
    expect(mergeLiveCapacity(live, stat)).toEqual({
      snapshot: live,
      windowSpend: null,
      windowStartedAt: null,
    });
  });

  it('uses the in-flight snapshot with no window data when nothing has ever been logged', () => {
    const live: RateLimitSnapshot = { status: 'allowed' };
    expect(mergeLiveCapacity(live, null)).toEqual({
      snapshot: live,
      windowSpend: null,
      windowStartedAt: null,
    });
  });
});
