import { RefreshIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import { capacityLevel, latestCapacity, mergeLiveCapacity, resetsAtMs } from '@/core/rate-limit';
import { Card, IconButton, Progress, Spinner, Stamp } from '@dendelion/paper-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { chalkStatusFill, chalkStatusText } from './shared';

const levelFill = {
  allowed: chalkStatusFill.pass,
  warning: chalkStatusFill.running,
  rejected: chalkStatusFill.fail,
} as const;

const levelText = {
  allowed: chalkStatusText.pass,
  warning: chalkStatusText.running,
  rejected: chalkStatusText.fail,
} as const;

function formatGap(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export interface CapacityRowProps {
  heightClassName?: string;
}

export const CapacityRow = ({ heightClassName = '' }: CapacityRowProps) => {
  const taskLog = useAppStore((s) => s.taskLog);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const refreshCapacity = useAppStore((s) => s.refreshCapacity);
  const probed = useAppStore((s) => s.probedCapacity);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const live = agentStatus.find((t) => t.rateLimit)?.rateLimit ?? null;
  const logged = useMemo(() => latestCapacity(taskLog), [taskLog]);
  const capacity = mergeLiveCapacity(live, probed ?? logged);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void refreshCapacity().finally(() => setRefreshing(false));
  }, [refreshCapacity]);

  // Once per session: a probe is cheap but not free, so a later mount reuses the
  // reading already in the store and leaves refreshing to the button.
  useEffect(() => {
    if (probed === null) refresh();
  }, [probed, refresh]);

  const snapshot = capacity?.snapshot ?? null;
  const level = capacityLevel(snapshot?.status ?? 'allowed');
  const fiveHour = snapshot?.unifiedWindows?.five_hour;
  const pct = fiveHour ? Math.round(fiveHour.utilization * 100) : 0;

  return (
    <Card surface="chalkboard" size="small" className={heightClassName}>
      <div className="flex h-full flex-col justify-between gap-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate font-handwritten text-sm leading-tight text-desk-chalk">
            {fiveHour?.resetsAt === undefined
              ? 'Capacity'
              : `Resets in ${formatGap(resetsAtMs(fiveHour.resetsAt) - now)}`}
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
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Progress
            className="min-w-0 flex-1"
            value={pct}
            max={100}
            // The chalk *Text* tokens are the light marks on the board; the *Fill*
            // tokens are dark stamp backgrounds and vanish against it.
            color={levelText[level]}
            surface="chalkboard"
          />
          <span className="flex shrink-0 items-center gap-2">
            {snapshot?.overage && (
              <Stamp
                surface="chalkboard"
                size="small"
                fillColor={chalkStatusFill.running}
                textColor={chalkStatusText.running}
              >
                overage
              </Stamp>
            )}
            <Stamp
              surface="chalkboard"
              size="small"
              fillColor={levelFill[level]}
              textColor={levelText[level]}
              className="leading-none"
            >
              {fiveHour ? `${pct}%` : (snapshot?.status ?? 'no report')}
            </Stamp>
          </span>
        </div>
      </div>
    </Card>
  );
};
