import type { PlanEntry } from '@/types/index';
import { Table } from '@dendelion/paper-ui';
import { KANBAN_COLUMNS, STATUS_ACCENT } from '../constants';
import { KanbanCard } from './kanban-card';

interface BoardViewProps {
  plans: PlanEntry[];
}

export const BoardView = ({ plans }: BoardViewProps) => {
  return (
    <Table
      className="board-view-table"
      board={KANBAN_COLUMNS.map(({ status, label }) => ({
        key: status,
        label,
        accent: STATUS_ACCENT[status],
        items: plans.filter(
          (p) => p.status === status || (status === 'in-progress' && p.status === 'review'),
        ),
        getKey: (plan: PlanEntry) => plan.title,
        renderItem: (plan: PlanEntry) => <KanbanCard plan={plan} />,
      }))}
    />
  );
};
