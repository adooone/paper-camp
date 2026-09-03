import { useAppStore } from '@/app/stores/app-store';
import { capacityLevel, latestCapacity, mergeLiveCapacity, resetsAtMs } from '@/core/rate-limit';
import { Card, Progress, Stamp } from '@dendelion/paper-ui';
import { useEffect, useMemo, useState } from 'react';
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

export const CapacityRow = () => {
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

  const refresh = () => {
    setRefreshing(true);
    void refreshCapacity().finally(() => setRefreshing(false));
  };

  if (!capacity) {
    return (
      <Card surface="chalkboard" size="small" className="flex items-center justify-between gap-2">
        <p className="m-0 text-2xs text-desk-text-muted opacity-70">
          No capacity report — you're clear of any limit.
        </p>
        <button type="button" className="text-2xs underline opacity-70" onClick={refresh}>
          {refreshing ? 'Checking…' : 'Check now'}
        </button>
      </Card>
    );
  }

  const { snapshot, capturedAt } = capacity;
  const level = capacityLevel(snapshot.status);
  const fiveHour = snapshot.unifiedWindows?.five_hour;
  const capturedMs = capturedAt ? Date.parse(capturedAt) : null;

  return (
    <Card surface="chalkboard" size="small" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp
          surface="chalkboard"
          size="small"
          fillColor={levelFill[level]}
          textColor={levelText[level]}
        >
          {snapshot.status}
        </Stamp>
        {snapshot.overage && (
          <Stamp
            surface="chalkboard"
            size="small"
            fillColor={chalkStatusFill.running}
            textColor={chalkStatusText.running}
          >
            overage
          </Stamp>
        )}
        <span className="ml-auto flex items-center gap-2 text-2xs text-desk-text-muted">
          {capturedMs !== null && !Number.isNaN(capturedMs) && (
            <span className="opacity-70">as of {formatGap(now - capturedMs)} ago</span>
          )}
          <button type="button" className="underline opacity-70" onClick={refresh}>
            {refreshing ? 'Checking…' : 'Refresh'}
          </button>
        </span>
      </div>
      {fiveHour && (
        <div className="flex items-center gap-2">
          <Progress
            className="flex-1"
            value={Math.round(fiveHour.utilization * 100)}
            max={100}
            color={levelFill[level]}
            height={4}
            surface="chalkboard"
          />
          <span className="shrink-0 text-2xs text-desk-text-muted">
            {Math.round(fiveHour.utilization * 100)}%
            {fiveHour.resetsAt === undefined
              ? ''
              : ` · resets in ${formatGap(resetsAtMs(fiveHour.resetsAt) - now)}`}
          </span>
        </div>
      )}
    </Card>
  );
};
