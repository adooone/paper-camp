import { medianSegmentMs, phaseFraction } from '@/core/phase-progress';
import type { AgentTaskState, TaskLogEntry } from '@/types/index';
import { useEffect, useState } from 'react';

const ACTIVE_STATUSES = new Set(['starting', 'running', 'stopping']);
const TICK_MS = 1000;

export interface RunningPhaseFill {
  index: number;
  fraction: number;
}

export function useRunningPhaseFill(
  planTask: AgentTaskState | undefined,
  taskLog: TaskLogEntry[],
): RunningPhaseFill | null {
  const active =
    planTask !== undefined &&
    planTask.phaseIndex !== undefined &&
    ACTIVE_STATUSES.has(planTask.status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  if (!active || planTask?.phaseIndex === undefined) return null;

  return {
    index: planTask.phaseIndex,
    fraction: phaseFraction({
      anchor: planTask.phaseAnchor,
      anchorEnteredAt: planTask.anchorEnteredAt,
      lastStreamAt: planTask.lastStreamAt,
      now,
      medians: medianSegmentMs(taskLog),
    }),
  };
}
