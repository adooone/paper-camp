import type { NightGateStatus, NightWindow, RateLimitSnapshot } from '../types/index';

const IDLE_DESK_MS = 30 * 60 * 1000;

function parseMinutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isWithinNightWindow(now: Date, window: NightWindow | undefined): boolean {
  if (!window) return true;
  const from = parseMinutesSinceMidnight(window.from);
  const to = parseMinutesSinceMidnight(window.to);
  if (from === to) return true;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return from < to ? nowMinutes >= from && nowMinutes < to : nowMinutes >= from || nowMinutes < to;
}

export interface NightGateInput {
  now: number;
  lastDashboardRequestAt: number | null;
  taskRunning: boolean;
  snapshot: RateLimitSnapshot | null;
  ceiling: number;
  floor: number;
  window?: NightWindow;
}

export function evaluateNightGate(input: NightGateInput): NightGateStatus {
  const reasons: NightGateStatus['reasons'] = [];

  const idleMs =
    input.lastDashboardRequestAt === null
      ? Number.POSITIVE_INFINITY
      : input.now - input.lastDashboardRequestAt;
  if (idleMs < IDLE_DESK_MS) reasons.push('dashboard-active');

  if (input.taskRunning) reasons.push('task-running');

  const fiveHour = input.snapshot?.unifiedWindows?.five_hour;
  const sevenDay = input.snapshot?.unifiedWindows?.seven_day;
  const fiveHourUtilizationPct = fiveHour ? fiveHour.utilization * 100 : null;
  const sevenDayUtilizationPct = sevenDay ? sevenDay.utilization * 100 : null;

  if (fiveHourUtilizationPct === null || sevenDayUtilizationPct === null) {
    reasons.push('no-capacity-snapshot');
  } else {
    if (fiveHourUtilizationPct > input.ceiling) reasons.push('five-hour-ceiling');
    if (sevenDayUtilizationPct > input.floor) reasons.push('seven-day-floor');
  }

  if (!isWithinNightWindow(new Date(input.now), input.window)) reasons.push('outside-window');

  return {
    open: reasons.length === 0,
    reasons,
    fiveHourUtilizationPct,
    sevenDayUtilizationPct,
  };
}
