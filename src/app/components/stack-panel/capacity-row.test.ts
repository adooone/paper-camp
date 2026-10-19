import { describe, expect, it } from 'vitest';
import {
  formatGap,
  formatResetTime,
  formatResetTooltip,
  formatWeeklyTooltip,
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
});
