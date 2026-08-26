import { color } from '@/app/styles/tokens';
import type { ProjectStats } from '@/types/index';
import { Progress } from '@dendelion/paper-ui';
import { StatCard, StatRow } from './stat-card';

export interface TasksPerWeekCardProps {
  tasksPerWeek: ProjectStats['tasksPerWeek'];
}

export const TasksPerWeekCard = ({ tasksPerWeek }: TasksPerWeekCardProps) => {
  const max = Math.max(1, ...tasksPerWeek.map((w) => w.count));
  return (
    <StatCard title="Tasks per week">
      {tasksPerWeek.length === 0 && <p className="opacity-50 m-0">No tasks run yet.</p>}
      {tasksPerWeek.map((week) => (
        <div key={week.week} className="flex flex-col gap-1">
          <StatRow label={week.week} value={week.count} />
          <Progress value={week.count} max={max} color={color.accentAmber} height={4} />
        </div>
      ))}
    </StatCard>
  );
};
