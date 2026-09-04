import { EmptyState } from '@/app/components';
import { formatTokens } from '@/core/phase-run';
import type { ProjectStats } from '@/types/index';
import { StatCard, StatRow } from './stat-card';

export interface MostExpensiveIdeasCardProps {
  mostExpensiveIdeas: ProjectStats['mostExpensiveIdeas'];
}

export const MostExpensiveIdeasCard = ({ mostExpensiveIdeas }: MostExpensiveIdeasCardProps) => (
  <StatCard title="Most expensive ideas">
    {mostExpensiveIdeas.length === 0 && <EmptyState message="No usage recorded yet." />}
    {mostExpensiveIdeas.map((idea) => (
      <div key={idea.planId} className="flex flex-col gap-0.5">
        <StatRow
          label={idea.planId}
          value={`${formatTokens(idea.inputTokens)} in · ${formatTokens(idea.outputTokens)} out`}
        />
        <span className="text-2xs opacity-50 truncate">{idea.planTitle}</span>
      </div>
    ))}
  </StatCard>
);
