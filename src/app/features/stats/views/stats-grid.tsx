import type { ProjectStats } from '@/types/index';
import { ClaudeCapacityCard } from './claude-capacity-card';
import { CodebaseSizeCard } from './codebase-size-card';
import { CommentRatioCard } from './comment-ratio-card';
import { EntitiesByStatusCard } from './entities-by-status-card';
import { MedianPhaseDurationCard } from './median-phase-duration-card';
import { MostExpensiveIdeasCard } from './most-expensive-ideas-card';
import { NotesCard } from './notes-card';
import { TasksPerWeekCard } from './tasks-per-week-card';
import { TestCoverageCard } from './test-coverage-card';
import { UsagePerWeekCard } from './usage-per-week-card';

export interface StatsGridProps {
  stats: ProjectStats;
}

export const StatsGrid = ({ stats }: StatsGridProps) => (
  <>
    <div className="flex flex-wrap items-start gap-2.5">
      <CommentRatioCard comments={stats.comments} />
      <TestCoverageCard testCoveragePct={stats.testCoveragePct} />
      <CodebaseSizeCard sourceLines={stats.comments.sourceLines} testLines={stats.testLines} />
      <EntitiesByStatusCard entitiesByStatus={stats.entitiesByStatus} />
      <NotesCard openQuestions={stats.openQuestions} decisions={stats.decisions} />
      <TasksPerWeekCard tasksPerWeek={stats.tasksPerWeek} />
      <UsagePerWeekCard usagePerWeek={stats.usagePerWeek} />
      <MedianPhaseDurationCard medianPhaseDurationMs={stats.medianPhaseDurationMs} />
      <MostExpensiveIdeasCard mostExpensiveIdeas={stats.mostExpensiveIdeas} />
      <ClaudeCapacityCard capacity={stats.capacity} />
    </div>
    <p className="opacity-[0.4] text-2xs mt-6">
      Generated {new Date(stats.generatedAt).toLocaleString()}
    </p>
  </>
);
