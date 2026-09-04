import { EmptyState } from '@/app/components';
import { color } from '@/app/styles/tokens';
import { formatTokens } from '@/core/phase-run';
import type { ProjectStats } from '@/types/index';
import { Progress } from '@dendelion/paper-ui';
import { StatCard, StatRow } from './stat-card';

export interface UsagePerWeekCardProps {
  usagePerWeek: ProjectStats['usagePerWeek'];
}

export const UsagePerWeekCard = ({ usagePerWeek }: UsagePerWeekCardProps) => {
  const max = Math.max(1, ...usagePerWeek.map((w) => w.agentMinutes));
  return (
    <StatCard title="Usage per week">
      {usagePerWeek.length === 0 && <EmptyState message="No usage recorded yet." />}
      {usagePerWeek.map((week) => (
        <div key={week.week} className="flex flex-col gap-1">
          <StatRow label={week.week} value={`${week.agentMinutes}m`} />
          <Progress value={week.agentMinutes} max={max} color={color.accentAmber} height={4} />
          <span className="text-2xs opacity-50">
            {formatTokens(week.inputTokens)} in · {formatTokens(week.outputTokens)} out
          </span>
        </div>
      ))}
    </StatCard>
  );
};
