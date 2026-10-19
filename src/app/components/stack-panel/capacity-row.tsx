import { useCapacity } from '@/app/hooks/use-capacity';
import { useAppStore } from '@/app/stores/app-store';
import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { RateLimitSnapshot, RateLimitWindow } from '@/types/index';
import {
  Card,
  IconButton,
  Progress,
  RefreshIcon,
  Spinner,
  Stamp,
  type StampVariant,
  Tooltip,
} from '@dendelion/folk-ui';
import { useEffect, useState } from 'react';
import { chalkStatusText } from './shared';

const levelVariant = {
  allowed: 'success',
  warning: 'warning',
  rejected: 'error',
} as const;

const levelText = {
  allowed: chalkStatusText.pass,
  warning: chalkStatusText.running,
  rejected: chalkStatusText.fail,
} as const;

const LIVE_STATUSES = new Set(['starting', 'running', 'stopping']);

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatGap(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatResetTime(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${WEEKDAY_SHORT[date.getDay()]} ${hh}:${mm}`;
}

export function formatResetTooltip(resetAtMs: number): string {
  return `window reset at ${new Date(resetAtMs).toLocaleTimeString()} — refresh for a reading`;
}

export function formatWeeklyTooltip(pct: number, resetAtMs?: number): string {
  const resets = resetAtMs === undefined ? '' : `, resets ${formatResetTime(resetAtMs)}`;
  return `Weekly window: ${pct}%${resets}`;
}

export interface WindowView {
  pct: number;
  isReset: boolean;
  resetAtMs?: number;
}

export function windowView(window: RateLimitWindow | undefined, now: number): WindowView | null {
  if (!window) return null;
  const resetAtMs = window.resetsAt === undefined ? undefined : resetsAtMs(window.resetsAt);
  const isReset = resetAtMs !== undefined && resetAtMs <= now;
  return { pct: Math.round(window.utilization * 100), isReset, resetAtMs };
}

export interface CapacityRowProps {
  heightClassName?: string;
}

const CapacityBarRow = ({
  label,
  view,
  level,
  fallback,
  tooltip,
  extraStamp,
}: {
  label: string;
  view: WindowView | null;
  level: keyof typeof levelVariant;
  fallback: string;
  tooltip: string;
  extraStamp?: React.ReactNode;
}) => {
  const isReset = view?.isReset ?? false;
  const pct = view?.pct ?? 0;
  const stampVariant: StampVariant = isReset ? 'warning' : levelVariant[level];
  const stampText = isReset ? 'reset' : view ? `${pct}%` : fallback;

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="w-6 shrink-0 font-handwritten text-xs text-desk-text-muted">{label}</span>
      <Progress
        className="min-w-0 flex-1"
        value={isReset ? 0 : pct}
        max={100}
        // The chalk *Text* tokens are the light marks that read on the board.
        color={levelText[level]}
        surface="chalkboard"
        sketch
      />
      <span className="flex shrink-0 items-center gap-2">
        {extraStamp}
        <Tooltip content={tooltip} surface="chalkboard">
          <Stamp surface="chalkboard" size="small" variant={stampVariant} className="leading-none">
            {stampText}
          </Stamp>
        </Tooltip>
      </span>
    </div>
  );
};

export const CapacityRow = ({ heightClassName = '' }: CapacityRowProps) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const { record, refreshing, refresh } = useCapacity();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const live: RateLimitSnapshot | null =
    agentStatus.find((t) => LIVE_STATUSES.has(t.status) && t.rateLimit)?.rateLimit ?? null;

  // On mount only: a probe is cheap but not free, so a fresh five-hour window
  // reuses the reading already on file and leaves refreshing to the button.
  useEffect(() => {
    const fiveHour = record?.snapshot.unifiedWindows?.five_hour;
    const expired = fiveHour?.resetsAt !== undefined && resetsAtMs(fiveHour.resetsAt) <= Date.now();
    if (!record || expired) refresh();
  }, [record, refresh]);

  const snapshot = live ?? record?.snapshot ?? null;
  const level = capacityLevel(snapshot?.status ?? 'allowed');
  const fiveHourWindow = snapshot?.unifiedWindows?.five_hour;
  const weeklyWindow = snapshot?.unifiedWindows?.seven_day;
  const fiveHour = windowView(fiveHourWindow, now);
  const weekly = windowView(weeklyWindow, now);
  const fallback = snapshot?.status ?? 'no report';

  const fiveHourTooltip = fiveHour?.isReset
    ? formatResetTooltip(fiveHour.resetAtMs as number)
    : `5-hour window usage: ${level}`;
  const weeklyTooltip = weekly?.isReset
    ? formatResetTooltip(weekly.resetAtMs as number)
    : formatWeeklyTooltip(weekly?.pct ?? 0, weekly?.resetAtMs);

  return (
    <Card surface="chalkboard" size="small" className={heightClassName}>
      <div className="flex h-full flex-col justify-between gap-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate pr-1 font-handwritten text-sm leading-tight text-desk-chalk">
            {fiveHourWindow?.resetsAt === undefined
              ? 'Capacity'
              : `Resets in ${formatGap(resetsAtMs(fiveHourWindow.resetsAt) - now)}`}
          </span>
          {refreshing ? (
            <span className="inline-flex shrink-0">
              <Spinner size="small" surface="chalkboard" label="Checking capacity" />
            </span>
          ) : (
            <IconButton
              icon={
                <span className="inline-flex">
                  <RefreshIcon size={14} />
                </span>
              }
              label="Refresh capacity"
              size="small"
              variant="ghost"
              surface="chalkboard"
              onClick={refresh}
              className="h-auto min-h-0 w-auto shrink-0 p-0"
            />
          )}
        </div>
        <CapacityBarRow
          label="5h"
          view={fiveHour}
          level={level}
          fallback={fallback}
          tooltip={fiveHourTooltip}
          extraStamp={
            snapshot?.overage && (
              <Tooltip
                content="Extra usage beyond the plan's included capacity."
                surface="chalkboard"
              >
                <Stamp surface="chalkboard" size="small" variant="warning">
                  overage
                </Stamp>
              </Tooltip>
            )
          }
        />
        <CapacityBarRow
          label="wk"
          view={weekly}
          level={level}
          fallback={fallback}
          tooltip={weeklyTooltip}
        />
      </div>
    </Card>
  );
};
