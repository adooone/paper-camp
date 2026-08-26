import { Card } from '@dendelion/paper-ui';
import { type TaskGroup, formatDayHeader } from '../helpers';
import { TASK_ROWS_GRID_CLASS, TaskRow } from './task-row';

const headerLabelClassName = 'text-sm font-semibold whitespace-nowrap overflow-hidden';

export interface TaskListProps {
  groups: TaskGroup[];
  highlightedId: string | undefined;
}

export const TaskList = ({ groups, highlightedId }: TaskListProps) => (
  <div className="flex flex-col gap-1">
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className={TASK_ROWS_GRID_CLASS}>
        <span />
        <span className={`${headerLabelClassName} opacity-60`}>Task</span>
        <span className={`${headerLabelClassName} opacity-60`}>Plan</span>
        <span className={`${headerLabelClassName} opacity-60`}>Agent</span>
        <span className={`max-lg:hidden ${headerLabelClassName} opacity-60`}>Time</span>
        <span className={`${headerLabelClassName} opacity-60`}>Outcome</span>
      </div>
    </Card>
    {groups.map((group) => (
      <div key={group.key} className="flex flex-col gap-1">
        <Card size="small" texture="kraft" className="plan-row-card">
          <span className={`${headerLabelClassName} opacity-75`}>
            {formatDayHeader(group.entries[0].endedAt)}
          </span>
        </Card>
        {group.entries.map((entry) => (
          <TaskRow key={entry.id} entry={entry} highlighted={entry.id === highlightedId} />
        ))}
      </div>
    ))}
  </div>
);
