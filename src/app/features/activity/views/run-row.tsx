import { PlanIdStamp } from '@/app/features/plans/components';
import { formatDuration } from '@/core/phase-run';
import { AGENT_LABELS, type LogRow } from '@/types/index';
import { Row, Stamp, Text } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';

const LOG_ROW_GRID_CLASS =
  'grid grid-cols-[100px_128px_minmax(0,1fr)_100px_72px_84px] gap-2.5 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

export interface LogRowViewProps {
  row: LogRow;
}

export const LogRowView = ({ row }: LogRowViewProps) => {
  const navigate = useNavigate();

  return (
    <Row
      surface="card"
      columns={{ title: 'minmax(0,1fr)' }}
      onClick={() => navigate({ to: '/activity/$entryId', params: { entryId: row.id } })}
      ariaLabel={row.title}
      title={
        <div className={LOG_ROW_GRID_CLASS}>
          <Text face="handwritten" size="sm" tone="muted" noWrap>
            {formatTime(row.timestamp)}
          </Text>
          <Stamp size="small" variant="neutral">
            {LOG_TYPE_LABELS[row.type]}
          </Stamp>
          <span className="flex min-w-0 items-center gap-2">
            <PlanIdStamp id={row.entityId} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.title}</span>
          </span>
          <Text face="handwritten" size="sm" tone="muted" truncate>
            {row.agentId ? AGENT_LABELS[row.agentId] : '—'}
          </Text>
          <Text face="handwritten" size="sm" tone="muted" noWrap>
            {row.durationMs != null ? formatDuration(row.durationMs) : '—'}
          </Text>
          <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]} dot={row.unread}>
            {row.outcome}
          </Stamp>
        </div>
      }
    />
  );
};
