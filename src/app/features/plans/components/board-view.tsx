import type { PlanEntry } from '@/types/index';
import { KANBAN_COLUMNS } from '../constants';
import { KanbanColumn } from './kanban-column';

interface BoardViewProps {
  plans: PlanEntry[];
}

export const BoardView = ({ plans }: BoardViewProps) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        overflowX: 'auto',
        paddingBottom: '1rem',
        alignItems: 'flex-start',
      }}
    >
      {KANBAN_COLUMNS.map(({ status, label, accent }) => (
        <KanbanColumn
          key={status}
          status={status}
          label={label}
          accent={accent}
          plans={plans.filter((p) => p.status === status)}
        />
      ))}
    </div>
  );
};
