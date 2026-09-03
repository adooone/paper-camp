import { useAppStore } from '@/app/stores/app-store';
import { formatTokens } from '@/core/phase-run';
import { capacityLevel, latestCapacity, mergeLiveCapacity, resetsAtMs } from '@/core/rate-limit';
import { Progress, Stamp } from '@dendelion/paper-ui';
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

export const CapacityRow = () => {
  const taskLog = useAppStore((s) => s.taskLog);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const live = agentStatus.find((t) => t.rateLimit)?.rateLimit ?? null;
  const stat = useMemo(() => latestCapacity(taskLog), [taskLog]);
  const capacity = mergeLiveCapacity(live, stat);

  if (!capacity) {
    return (
      <p className="m-0 text-2xs text-desk-text-muted opacity-70">
        No capacity report — you're clear of any limit.
      </p>
    );
  }

  const level = capacityLevel(capacity.snapshot.status);
  const resetsAt = capacity.snapshot.resetsAt;
  const windowStartMs = capacity.windowStartedAt ? Date.parse(capacity.windowStartedAt) : null;
  let elapsedFraction: number | null = null;
  if (resetsAt !== undefined && windowStartMs !== null && !Number.isNaN(windowStartMs)) {
    const totalMs = resetsAtMs(resetsAt) - windowStartMs;
    elapsedFraction = totalMs > 0 ? Math.min(1, Math.max(0, (now - windowStartMs) / totalMs)) : 0;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp
          surface="chalkboard"
          size="small"
          fillColor={levelFill[level]}
          textColor={levelText[level]}
        >
          {capacity.snapshot.status}
        </Stamp>
        {capacity.snapshot.overage && (
          <Stamp
            surface="chalkboard"
            size="small"
            fillColor={chalkStatusFill.running}
            textColor={chalkStatusText.running}
          >
            overage
          </Stamp>
        )}
        {capacity.windowSpend && (
          <span className="text-2xs text-desk-text-muted">
            {formatTokens(capacity.windowSpend.inputTokens)} in ·{' '}
            {formatTokens(capacity.windowSpend.outputTokens)} out this window
          </span>
        )}
      </div>
      {elapsedFraction !== null && (
        <Progress
          value={elapsedFraction * 100}
          max={100}
          color={levelFill[level]}
          height={4}
          surface="chalkboard"
        />
      )}
    </div>
  );
};
