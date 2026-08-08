import { PageTitle } from '@/app/components/page-title';
import { STATUS_LABEL } from '@/app/features/plans/constants';
import { fetchStats } from '@/app/services/content';
import { color } from '@/app/styles/tokens';
import { formatDuration, formatTokens } from '@/core/phase-run';
import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import { type EntityStatus, PLAN_STATUSES, type ProjectStats } from '@/types/index';
import { Card, Progress, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const ENTITY_STATUS_ORDER: EntityStatus[] = ['open', ...PLAN_STATUSES];

const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = { ...STATUS_LABEL, open: 'Open' };

const pct = (value: number) => `${Math.round(value * 100)}%`;

const StatCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex-[1_1_260px] max-w-[360px] max-[480px]:flex-[1_1_100%] max-[480px]:max-w-none">
    <Card size="small" texture="kraft" className="h-full">
      <div className="flex flex-col gap-3">
        <span className="font-handwritten text-xs font-semibold opacity-[0.55]">{title}</span>
        {children}
      </div>
    </Card>
  </div>
);

const StatRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="opacity-70">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);

const CommentRatioCard = ({ comments }: { comments: ProjectStats['comments'] }) => (
  <StatCard title="Comment ratio">
    <Progress value={comments.ratio * 100} color={color.accentSlate} />
    <StatRow label="Ratio" value={pct(comments.ratio)} />
    <StatRow label="Comment lines" value={comments.commentLines} />
    <StatRow label="Source lines" value={comments.sourceLines} />
  </StatCard>
);

const TestCoverageCard = ({ testCoveragePct }: { testCoveragePct: number | null }) => (
  <StatCard title="Test coverage">
    {testCoveragePct === null ? (
      <p className="opacity-50 m-0">Run `pnpm test` to generate a coverage report.</p>
    ) : (
      <>
        <Progress value={testCoveragePct} color={color.accentGreen} />
        <StatRow label="Line coverage" value={`${Math.round(testCoveragePct)}%`} />
      </>
    )}
  </StatCard>
);

const CodebaseSizeCard = ({
  sourceLines,
  testLines,
}: { sourceLines: number; testLines: number }) => (
  <StatCard title="Codebase size">
    <StatRow label="Source lines" value={sourceLines} />
    <StatRow label="Test lines" value={testLines} />
  </StatCard>
);

const EntitiesByStatusCard = ({
  entitiesByStatus,
}: { entitiesByStatus: ProjectStats['entitiesByStatus'] }) => (
  <StatCard title="Entities by status">
    {ENTITY_STATUS_ORDER.filter((status) => entitiesByStatus[status]).map((status) => (
      <StatRow key={status} label={ENTITY_STATUS_LABEL[status]} value={entitiesByStatus[status]} />
    ))}
    {Object.keys(entitiesByStatus).length === 0 && (
      <p className="opacity-50 m-0">No entities yet.</p>
    )}
  </StatCard>
);

const NotesCard = ({ openQuestions, decisions }: { openQuestions: number; decisions: number }) => (
  <StatCard title="Notes">
    <StatRow label="Open questions" value={openQuestions} />
    <StatRow label="Decisions" value={decisions} />
  </StatCard>
);

const TasksPerWeekCard = ({ tasksPerWeek }: { tasksPerWeek: ProjectStats['tasksPerWeek'] }) => {
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

const UsagePerWeekCard = ({ usagePerWeek }: { usagePerWeek: ProjectStats['usagePerWeek'] }) => {
  const max = Math.max(1, ...usagePerWeek.map((w) => w.agentMinutes));
  return (
    <StatCard title="Usage per week">
      {usagePerWeek.length === 0 && <p className="opacity-50 m-0">No usage recorded yet.</p>}
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

const MedianPhaseDurationCard = ({
  medianPhaseDurationMs,
}: { medianPhaseDurationMs: number | null }) => (
  <StatCard title="Median phase duration">
    {medianPhaseDurationMs === null ? (
      <p className="opacity-50 m-0">No phase runs recorded yet.</p>
    ) : (
      <StatRow label="Median" value={formatDuration(medianPhaseDurationMs)} />
    )}
  </StatCard>
);

const MostExpensiveIdeasCard = ({
  mostExpensiveIdeas,
}: { mostExpensiveIdeas: ProjectStats['mostExpensiveIdeas'] }) => (
  <StatCard title="Most expensive ideas">
    {mostExpensiveIdeas.length === 0 && <p className="opacity-50 m-0">No usage recorded yet.</p>}
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

const CAPACITY_STAMP = {
  allowed: 'success',
  warning: 'warning',
  rejected: 'error',
} as const;

const ClaudeCapacityCard = ({ capacity }: { capacity: ProjectStats['capacity'] }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <StatCard title="Claude capacity">
      {capacity === null ? (
        <p className="opacity-50 m-0">No agent run has reported capacity yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Stamp size="small" variant={CAPACITY_STAMP[capacityLevel(capacity.snapshot.status)]}>
              {capacity.snapshot.status}
            </Stamp>
            {capacity.snapshot.overage && (
              <Stamp size="small" variant="warning">
                overage
              </Stamp>
            )}
          </div>
          {capacity.snapshot.rateLimitType && (
            <StatRow label="Window" value={capacity.snapshot.rateLimitType} />
          )}
          {capacity.snapshot.resetsAt !== undefined && (
            <StatRow
              label="Resets"
              value={new Date(resetsAtMs(capacity.snapshot.resetsAt)).toLocaleTimeString()}
            />
          )}
          <span className="text-2xs opacity-50">
            as of last agent run,{' '}
            {formatDuration(Math.max(0, now - Date.parse(capacity.capturedAt)))} ago
          </span>
        </>
      )}
    </StatCard>
  );
};

export const StatsPage = () => {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setLoadFailed(true));
  }, []);

  return (
    <div>
      <PageTitle>Stats</PageTitle>
      <p className="opacity-50 mb-6">
        A read-only look at project health — every number here is informational, none of them gate
        anything.
      </p>
      {loadFailed && <p className="opacity-50">Couldn't load stats.</p>}
      {!loadFailed && !stats && <p className="opacity-50">Loading…</p>}
      {stats && (
        <>
          <div className="flex flex-wrap items-start gap-2.5">
            <CommentRatioCard comments={stats.comments} />
            <TestCoverageCard testCoveragePct={stats.testCoveragePct} />
            <CodebaseSizeCard
              sourceLines={stats.comments.sourceLines}
              testLines={stats.testLines}
            />
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
      )}
    </div>
  );
};
