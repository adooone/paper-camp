import { PlanIdStamp } from '@/app/features/plans/components';
import { useAppStore } from '@/app/stores/app-store';
import { formatDuration } from '@/core/phase-run';
import { logRowIdForTask } from '@/core/run-rows';
import { AGENT_LABELS, type AgentTaskState, type LogRow } from '@/types/index';
import { Button, Card } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { StopRunButton } from './run-row-detail';

const TICK_MS = 1000;

function useElapsedMs(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now - Date.parse(startedAt);
}

const RunningRunCard = ({ task }: { task: AgentTaskState }) => {
  const navigate = useNavigate();
  const plans = useAppStore((s) => s.plans);
  const elapsed = useElapsedMs(task.startedAt);
  const phaseCount = plans?.entries.find((p) => p.id === task.planId)?.phases.length;
  const latestLine = task.lines.at(-1)?.trim();

  const openLog = () =>
    navigate({ to: '/activity/$entryId', params: { entryId: logRowIdForTask(task) } });

  return (
    <Card size="small" texture="parchment" fill="amber" className="flex flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-watercolor-amber-dark motion-reduce:animate-none" />
        <span className="font-handwritten text-sm font-semibold">
          {task.status === 'stopping' ? 'Stopping…' : 'Running'}
        </span>
        <PlanIdStamp id={task.planId} />
        {task.phaseIndex !== undefined && (
          <span className="font-handwritten text-sm opacity-70">
            phase {task.phaseIndex + 1}
            {phaseCount ? ` of ${phaseCount}` : ''}
          </span>
        )}
        <span className="font-handwritten text-sm opacity-70">{formatDuration(elapsed)}</span>
        <span className="font-handwritten text-sm opacity-70">{AGENT_LABELS[task.agentId]}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button size="small" variant="ghost" onClick={openLog}>
            Open log
          </Button>
          {task.status !== 'stopping' && <StopRunButton taskId={task.id} />}
        </div>
      </div>
      {latestLine && (
        <p className="m-0 min-w-0 truncate font-mono text-xs opacity-70">{latestLine}</p>
      )}
    </Card>
  );
};

export const RunningRunsSection = ({ rows }: { rows: LogRow[] }) => {
  const tasks = rows
    .map((row) => (row.source.kind === 'running' ? row.source.task : undefined))
    .filter((task): task is AgentTaskState => task !== undefined);
  if (tasks.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-2">
      {tasks.map((task) => (
        <RunningRunCard key={task.id} task={task} />
      ))}
    </div>
  );
};
