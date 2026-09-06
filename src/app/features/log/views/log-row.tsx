import { PlanIdStamp } from '@/app/features/plans/components';
import { formatDuration } from '@/core/phase-run';
import { AGENT_LABELS, type LogRow } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';
import type { LogRowActions } from '../hooks/use-log-page';
import { LogRowDetail } from './log-row-detail';

export const LOG_ROW_GRID_CLASS =
  'grid grid-cols-[20px_64px_128px_minmax(0,1fr)_110px_64px_84px] gap-2.5 items-center max-lg:grid-cols-[20px_64px_128px_minmax(0,1fr)_84px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

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

export interface LogRowViewProps {
  row: LogRow;
  actions: LogRowActions;
}

export const LogRowView = ({ row, actions }: LogRowViewProps) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);

  return (
    <div className="flex flex-col gap-1 rounded-[10px]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggle}
        className="group block w-full cursor-pointer rounded-[10px] border-none bg-transparent p-0 text-left"
      >
        <Card size="small" texture="canvas" className="plan-row-card">
          <div className={LOG_ROW_GRID_CLASS}>
            <span className="inline-flex items-center opacity-50">
              <ChevronRightIcon className="group-aria-expanded:rotate-90" />
            </span>
            <span className="font-mono text-xs opacity-[0.55] whitespace-nowrap">
              {formatTime(row.timestamp)}
            </span>
            <Stamp size="small" variant="neutral">
              {LOG_TYPE_LABELS[row.type]}
            </Stamp>
            <span className="flex min-w-0 items-center gap-2">
              <PlanIdStamp id={row.entityId} />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.title}</span>
            </span>
            <span className="text-sm opacity-50 whitespace-nowrap overflow-hidden text-ellipsis">
              {row.agentId ? AGENT_LABELS[row.agentId] : ''}
            </span>
            <span className="max-lg:hidden font-mono text-xs opacity-[0.55] whitespace-nowrap">
              {row.durationMs != null ? formatDuration(row.durationMs) : ''}
            </span>
            <div className="flex items-center">
              <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]}>
                {row.outcome}
              </Stamp>
            </div>
          </div>
        </Card>
      </button>
      {expanded && (
        <Card size="small" texture="kraft" className="plan-row-card">
          <LogRowDetail row={row} actions={actions} />
        </Card>
      )}
    </div>
  );
};
