import { color } from '@/app/styles/tokens';
import { AGENT_LABELS, type TaskKind, type TaskLogEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { formatTime } from '../helpers';
import { TaskLogLines } from './task-log-lines';

const TASK_KIND_LABELS: Record<TaskKind, string> = {
  phase: 'Phase run',
  audit: 'Audit',
  'batch-reconcile': 'Batch reconcile',
  'batch-draft': 'Batch draft',
  'run-all': 'Run all phases',
  draft: 'Draft',
  extend: 'Extend',
  suggest: 'Suggest ideas',
  'commit-suggest': 'Commit suggest',
  'overlap-check': 'Overlap check',
  prioritise: 'Prioritise queue',
  sync: 'Sync',
  reconcile: 'Reconcile',
  'fix-review': 'Fix review',
  'resolve-conflict': 'Resolve conflict',
  feedback: 'Feedback reply',
  'pr-review': 'PR review',
  'issue-fix': 'Issue fix',
};

export const TASK_ROWS_GRID_CLASS =
  'grid grid-cols-[20px_116px_minmax(0,1fr)_88px_150px_72px] gap-2.5 items-center max-lg:grid-cols-[20px_116px_minmax(0,1fr)_88px_72px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

const ChevronRightIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export interface TaskRowProps {
  entry: TaskLogEntry;
  highlighted: boolean;
}

export const TaskRow = ({ entry, highlighted }: TaskRowProps) => {
  const [expanded, setExpanded] = useState(highlighted);
  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);
  const toggle = () => setExpanded((v) => !v);

  return (
    <div
      className={
        highlighted
          ? 'task-row-highlighted flex flex-col gap-1 rounded-[10px] outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]'
          : 'flex flex-col gap-1 rounded-[10px]'
      }
    >
      {/* biome-ignore lint/a11y/useSemanticElements: the clickable row wraps a Card whose block layout a native <button> would break; keyboard toggling is wired on the div. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="group cursor-pointer rounded-[10px]"
      >
        <Card size="small" texture="canvas" className="plan-row-card">
          <div className={TASK_ROWS_GRID_CLASS}>
            <span className="inline-flex items-center opacity-50">
              <ChevronRightIcon className="group-aria-expanded:rotate-90" />
            </span>
            <span className="font-semibold whitespace-nowrap overflow-hidden">
              {TASK_KIND_LABELS[entry.taskKind] ?? entry.taskKind}
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap opacity-70">
              {entry.planTitle}
            </span>
            <span className="text-sm opacity-50 whitespace-nowrap">
              {AGENT_LABELS[entry.agentId]}
            </span>
            <span className="max-lg:hidden font-mono text-xs opacity-[0.55] whitespace-nowrap">
              {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
            </span>
            <div className="flex items-center">
              <Stamp
                size="small"
                fillColor={
                  entry.outcome === 'done'
                    ? 'rgba(143, 185, 150, 0.25)'
                    : entry.outcome === 'superseded'
                      ? 'rgba(212, 163, 115, 0.25)'
                      : 'rgba(201, 139, 139, 0.25)'
                }
                textColor={
                  entry.outcome === 'done'
                    ? color.accentGreenDark
                    : entry.outcome === 'superseded'
                      ? color.accentAmberDark
                      : color.accentRoseDark
                }
              >
                {entry.outcome}
              </Stamp>
            </div>
          </div>
        </Card>
      </div>
      {expanded && (
        <Card size="small" texture="kraft" className="plan-row-card">
          {entry.outcome === 'error' && entry.reason && (
            <p className="m-0 mb-2 text-sm text-state-danger">{entry.reason}</p>
          )}
          <TaskLogLines id={entry.id} />
        </Card>
      )}
    </div>
  );
};
