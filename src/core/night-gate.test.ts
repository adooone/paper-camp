import { describe, expect, it } from 'vitest';
import type { RateLimitSnapshot } from '../types/index';
import { evaluateNightGate, isWithinNightWindow } from './night-gate';

function snapshot(fiveHourPct: number, sevenDayPct: number): RateLimitSnapshot {
  return {
    status: 'allowed',
    unifiedWindows: {
      five_hour: { utilization: fiveHourPct / 100 },
      seven_day: { utilization: sevenDayPct / 100 },
    },
  };
}

const BASE = {
  now: Date.parse('2026-06-01T12:00:00Z'),
  lastDashboardRequestAt: null,
  taskRunning: false,
  ceiling: 50,
  floor: 70,
};

describe('evaluateNightGate', () => {
  it('is open when every condition is healthy', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: snapshot(10, 10) });
    expect(gate).toEqual({
      open: true,
      reasons: [],
      fiveHourUtilizationPct: 10,
      sevenDayUtilizationPct: 10,
    });
  });

  it('blocks when the dashboard was requested within the last 30 minutes', () => {
    const gate = evaluateNightGate({
      ...BASE,
      snapshot: snapshot(10, 10),
      lastDashboardRequestAt: BASE.now - 10 * 60 * 1000,
    });
    expect(gate.open).toBe(false);
    expect(gate.reasons).toEqual(['dashboard-active']);
  });

  it('opens once the dashboard has been idle for 30 minutes', () => {
    const gate = evaluateNightGate({
      ...BASE,
      snapshot: snapshot(10, 10),
      lastDashboardRequestAt: BASE.now - 30 * 60 * 1000,
    });
    expect(gate.open).toBe(true);
  });

  it('blocks while an agent task is running', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: snapshot(10, 10), taskRunning: true });
    expect(gate.reasons).toEqual(['task-running']);
  });

  it('blocks when there is no capacity snapshot yet, rather than assume it is safe', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: null });
    expect(gate.reasons).toEqual(['no-capacity-snapshot']);
    expect(gate.fiveHourUtilizationPct).toBeNull();
    expect(gate.sevenDayUtilizationPct).toBeNull();
  });

  it('blocks when the five-hour ceiling is exceeded', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: snapshot(51, 10) });
    expect(gate.reasons).toEqual(['five-hour-ceiling']);
  });

  it('does not block exactly at the ceiling', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: snapshot(50, 10) });
    expect(gate.open).toBe(true);
  });

  it('blocks when the seven-day floor is exceeded — the setting to tune first', () => {
    const gate = evaluateNightGate({ ...BASE, snapshot: snapshot(10, 71) });
    expect(gate.reasons).toEqual(['seven-day-floor']);
  });

  it('reports every blocking reason at once', () => {
    const gate = evaluateNightGate({
      ...BASE,
      snapshot: snapshot(90, 90),
      taskRunning: true,
      lastDashboardRequestAt: BASE.now,
    });
    expect(gate.reasons).toEqual([
      'dashboard-active',
      'task-running',
      'five-hour-ceiling',
      'seven-day-floor',
    ]);
  });

  it('blocks outside a configured clock window', () => {
    const gate = evaluateNightGate({
      ...BASE,
      now: new Date(2026, 5, 1, 12, 0).getTime(),
      snapshot: snapshot(10, 10),
      window: { from: '22:00', to: '06:00' },
    });
    expect(gate.reasons).toEqual(['outside-window']);
  });

  it('is open inside an overnight clock window', () => {
    const gate = evaluateNightGate({
      ...BASE,
      now: new Date(2026, 5, 1, 23, 30).getTime(),
      snapshot: snapshot(10, 10),
      window: { from: '22:00', to: '06:00' },
    });
    expect(gate.open).toBe(true);
  });
});

describe('isWithinNightWindow', () => {
  const at = (hours: number, minutes = 0) => new Date(2026, 5, 1, hours, minutes);

  it('is always true when no window is configured', () => {
    expect(isWithinNightWindow(at(12), undefined)).toBe(true);
  });

  it('handles a same-day window', () => {
    const window = { from: '01:00', to: '05:00' };
    expect(isWithinNightWindow(at(3), window)).toBe(true);
    expect(isWithinNightWindow(at(12), window)).toBe(false);
  });

  it('handles a window that wraps past midnight', () => {
    const window = { from: '22:00', to: '06:00' };
    expect(isWithinNightWindow(at(23), window)).toBe(true);
    expect(isWithinNightWindow(at(3), window)).toBe(true);
    expect(isWithinNightWindow(at(12), window)).toBe(false);
  });

  it('treats an equal from/to as unrestricted', () => {
    expect(isWithinNightWindow(at(12), { from: '08:00', to: '08:00' })).toBe(true);
  });
});
