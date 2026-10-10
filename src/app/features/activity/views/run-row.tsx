import { PlanIdStamp } from '@/app/features/plans/components';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import { formatDuration } from '@/core/phase-run';
import { AGENT_LABELS, type LogRow } from '@/types/index';
import { Row, Stamp, Text } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';

// The agent column only fits beside a readable title on a wide screen.
const LOG_ROW_GRID_CLASS =
  'grid grid-cols-[92px_112px_minmax(0,1fr)_60px_80px] min-[1440px]:grid-cols-[92px_112px_minmax(0,1fr)_96px_60px_80px] gap-2.5 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

export interface LogRowViewProps {
  row: LogRow;
  project?: ScopeRow;
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
}

export const LogRowView = ({ row, project, onOpenCrossProject }: LogRowViewProps) => {
  const navigate = useNavigate();
  const foreign = project && !project.isCurrent ? project : undefined;
  const handleOpen =
    foreign && onOpenCrossProject
      ? () => onOpenCrossProject(foreign, `/activity/${row.id}`)
      : () => navigate({ to: '/activity/$entryId', params: { entryId: row.id } });

  return (
    <Row
      surface="card"
      columns={{ title: 'minmax(0,1fr)' }}
      onClick={handleOpen}
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
            {project && <ProjectChip project={project} />}
            <span className="shrink-0">
              <PlanIdStamp id={row.entityId} />
            </span>
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {row.title}
            </span>
          </span>
          <Text face="handwritten" size="sm" tone="muted" truncate className="max-[1439px]:hidden">
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
