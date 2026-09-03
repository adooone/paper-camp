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
    });
  });
});

describe('mergeLiveCapacity', () => {
  const stat: CapacityStat = {
    snapshot: { status: 'allowed_warning', resetsAt: 4_000_000_000 },
    capturedAt: '2026-08-01T10:00:00Z',
  };

  it('returns null when neither the live task nor the log has ever reported capacity', () => {
    expect(mergeLiveCapacity(null, null)).toBeNull();
  });

  it('falls back to the logged snapshot when no task is in flight', () => {
    expect(mergeLiveCapacity(null, stat)).toEqual({
      snapshot: stat.snapshot,
      capturedAt: stat.capturedAt,
    });
  });

  it('prefers the in-flight snapshot, which is current by definition', () => {
    const live: RateLimitSnapshot = { status: 'rejected', resetsAt: stat.snapshot.resetsAt };
    expect(mergeLiveCapacity(live, stat)).toEqual({ snapshot: live, capturedAt: null });
  });

  it('uses the in-flight snapshot when nothing has ever been logged', () => {
    const live: RateLimitSnapshot = { status: 'allowed' };
    expect(mergeLiveCapacity(live, null)).toEqual({ snapshot: live, capturedAt: null });
  });
});
