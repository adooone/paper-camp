import { PlanIdStamp } from '@/app/features/plans/components';
import type { LogRow } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatTime } from '../helpers';

export const LOG_ROW_GRID_CLASS =
  'grid grid-cols-[64px_128px_minmax(0,1fr)_84px] gap-2.5 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

export interface LogRowViewProps {
  row: LogRow;
}

export const LogRowView = ({ row }: LogRowViewProps) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/log/$entryId', params: { entryId: row.id } })}
      className="group block w-full cursor-pointer rounded-[10px] border-none bg-transparent p-0 text-left"
    >
      <Card size="small" texture="canvas" className="plan-row-card">
        <div className={LOG_ROW_GRID_CLASS}>
          <span className="font-handwritten text-xs opacity-[0.55] whitespace-nowrap">
            {formatTime(row.timestamp)}
          </span>
          <Stamp size="small" variant="neutral">
            {LOG_TYPE_LABELS[row.type]}
          </Stamp>
          <span className="flex min-w-0 items-center gap-2">
            <PlanIdStamp id={row.entityId} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.title}</span>
          </span>
          <div className="flex items-center">
            <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]} dot={row.unread}>
              {row.outcome}
            </Stamp>
          </div>
        </div>
      </Card>
    </button>
  );
};
