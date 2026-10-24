import type { CapacityRecord } from '@/core/capacity';
import { describe, expect, it } from 'vitest';
import {
  formatEmptyTooltip,
  formatGap,
  formatOutdatedTooltip,
  formatRelative,
  formatResetTime,
  formatResetTooltip,
  formatWeeklyTooltip,
  mountProbeDecision,
  windowView,
} from './capacity-row';

describe('formatGap', () => {
  it('shows minutes under an hour', () => {
    expect(formatGap(5 * 60_000)).toBe('5m');
  });

  it('shows hours and minutes under a day', () => {
    expect(formatGap(3 * 60 * 60_000 + 15 * 60_000)).toBe('3h 15m');
  });

  it('drops the minutes when they are exactly on the hour', () => {
    expect(formatGap(2 * 60 * 60_000)).toBe('2h');
  });

  it('shows days at or beyond 24 hours', () => {
    expect(formatGap(2 * 24 * 60 * 60_000)).toBe('2d');
  });

  it('clamps negative gaps to zero', () => {
    expect(formatGap(-5_000)).toBe('0m');
  });
});

describe('formatResetTime', () => {
  it('names the weekday and the 24-hour time', () => {
    const ms = new Date('2026-10-20T14:00:00').getTime();
    expect(formatResetTime(ms)).toBe('Tue 14:00');
  });
});

describe('formatResetTooltip', () => {
  it('names the reset time and points at refresh', () => {
    const ms = new Date('2026-10-20T14:00:00').getTime();
    expect(formatResetTooltip(ms)).toBe(
      `window reset at ${new Date(ms).toLocaleTimeString()} — refresh for a reading`,
    );
  });
});

describe('formatWeeklyTooltip', () => {
  it('names the utilisation and the reset time', () => {
    const ms = new Date('2026-10-20T14:00:00').getTime();
    expect(formatWeeklyTooltip(50, ms)).toBe('Weekly window: 50%, resets Tue 14:00');
  });

  it('drops the reset clause when there is no resetsAt', () => {
    expect(formatWeeklyTooltip(50, undefined)).toBe('Weekly window: 50%');
  });
});

describe('formatRelative', () => {
  it('reads as just now under a minute', () => {
    expect(formatRelative(30_000)).toBe('just now');
  });

  it('shows minutes under an hour', () => {
    expect(formatRelative(5 * 60_000)).toBe('5 min ago');
  });

  it('shows hours under a day', () => {
    expect(formatRelative(3 * 60 * 60_000)).toBe('3 h ago');
  });

  it('shows days at or beyond 24 hours', () => {
    expect(formatRelative(2 * 24 * 60 * 60_000)).toBe('2 d ago');
  });
});

describe('formatOutdatedTooltip', () => {
  it('names the reading age when there is no error', () => {
    expect(formatOutdatedTooltip('2 d ago', null)).toBe('Last reading 2 d ago');
  });

  it('appends the refresh failure when there is an error', () => {
    expect(formatOutdatedTooltip('3 h ago', new Error('404 Not Found'))).toBe(
      'Last reading 3 h ago — refresh failed: 404 Not Found',
    );
  });
});

describe('formatEmptyTooltip', () => {
  it('points at refresh when there is no error', () => {
    expect(formatEmptyTooltip(null)).toBe('click refresh for a reading');
  });

  it('carries the refresh failure when there is an error', () => {
    expect(formatEmptyTooltip(new Error('Not signed in'))).toBe('refresh failed: Not signed in');
  });
});

describe('windowView', () => {
  it('is null when there is no window at all', () => {
    expect(windowView(undefined, Date.now())).toBeNull();
  });

  it('rounds utilization into a percentage', () => {
    expect(windowView({ utilization: 0.503 }, Date.now())).toEqual({
      pct: 50,
      isReset: false,
      resetAtMs: undefined,
    });
  });

  it('is reset once resetsAt has passed', () => {
    const now = Date.now();
    const view = windowView({ utilization: 0.9, resetsAt: Math.floor((now - 1000) / 1000) }, now);
    expect(view?.isReset).toBe(true);
  });

  it('is not reset while resetsAt is still ahead', () => {
    const now = Date.now();
    const view = windowView({ utilization: 0.9, resetsAt: Math.floor((now + 60_000) / 1000) }, now);
    expect(view?.isReset).toBe(false);
  });

  it('clamps an overage utilization to 100%', () => {
    expect(windowView({ utilization: 1.12 }, Date.now())?.pct).toBe(100);
  });
});

const recordWithFiveHour = (resetsAt?: number): CapacityRecord => ({
  snapshot: { status: 'allowed', unifiedWindows: { five_hour: { utilization: 0.1, resetsAt } } },
  capturedAt: '2026-01-01T00:00:00.000Z',
  source: 'probe',
});

describe('mountProbeDecision', () => {
  const now = Date.now();

  it('does not settle while the query is still loading', () => {
    expect(mountProbeDecision(false, true, null, now)).toEqual({ settle: false, probe: false });
  });

  it('settles and probes when there is no record on file', () => {
    expect(mountProbeDecision(false, false, null, now)).toEqual({ settle: true, probe: true });
  });

  it('settles without probing when the record has a fresh five-hour window', () => {
    const record = recordWithFiveHour(Math.floor((now + 60_000) / 1000));
    expect(mountProbeDecision(false, false, record, now)).toEqual({ settle: true, probe: false });
  });

  it('settles and probes when the five-hour window has already reset', () => {
    const record = recordWithFiveHour(Math.floor((now - 1000) / 1000));
    expect(mountProbeDecision(false, false, record, now)).toEqual({ settle: true, probe: true });
  });

  it('never settles again once already settled, regardless of the record', () => {
    expect(mountProbeDecision(true, false, null, now)).toEqual({ settle: false, probe: false });
  });
});
