import { PlanIdStamp } from '@/app/features/plans/components';
import { formatDuration } from '@/core/phase-run';
import { AGENT_LABELS, type LogRow } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';

export const LOG_ROW_GRID_CLASS =
  'grid grid-cols-[64px_128px_minmax(0,1fr)_110px_64px_84px] gap-2.5 items-center max-lg:grid-cols-[64px_128px_minmax(0,1fr)_84px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

export interface LogRowViewProps {
  row: LogRow;
}

export const LogRowView = ({ row }: LogRowViewProps) => (
  <Card size="small" texture="canvas" className="plan-row-card">
    <div className={LOG_ROW_GRID_CLASS}>
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
);
