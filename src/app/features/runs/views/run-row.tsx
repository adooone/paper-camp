import { PlanIdStamp } from '@/app/features/plans/components';
import { formatDuration } from '@/core/phase-run';
import { AGENT_LABELS, type LogRow } from '@/types/index';
import { MetaLine, Row, type RowColumns, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';

export const LOG_ROW_COLUMNS: RowColumns = {
  id: 'auto',
  title: 'minmax(0,1fr)',
  meta: '320px',
  trailing: '84px',
};

export interface LogRowViewProps {
  row: LogRow;
}

export const LogRowView = ({ row }: LogRowViewProps) => {
  const navigate = useNavigate();

  return (
    <Row
      surface="card"
      columns={LOG_ROW_COLUMNS}
      onClick={() => navigate({ to: '/log/$entryId', params: { entryId: row.id } })}
      ariaLabel={row.title}
      id={<PlanIdStamp id={row.entityId} />}
      title={row.title}
      meta={
        <MetaLine>
          {formatTime(row.timestamp)} · {LOG_TYPE_LABELS[row.type]} ·{' '}
          {row.agentId ? AGENT_LABELS[row.agentId] : '—'} ·{' '}
          {row.durationMs != null ? formatDuration(row.durationMs) : '—'}
        </MetaLine>
      }
      trailing={
        <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]} dot={row.unread}>
          {row.outcome}
        </Stamp>
      }
    />
  );
};
