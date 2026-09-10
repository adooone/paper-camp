import { EmptyState } from '@/app/components';
import type { ChunkHealth, ProjectStats } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { StatCard, StatRow } from './stat-card';

const scoreVariant = (score: number): 'error' | 'warning' | 'success' => {
  if (score >= 67) return 'error';
  if (score >= 34) return 'warning';
  return 'success';
};

const formatSignals = (chunk: ChunkHealth): string => {
  const { churnCommits, lines, coveragePct } = chunk.signals;
  const coverage =
    coveragePct === null ? 'coverage unknown' : `${Math.round(coveragePct)}% covered`;
  const reviewed = chunk.lastReviewedAt
    ? `reviewed ${new Date(chunk.lastReviewedAt).toLocaleDateString()}`
    : 'never reviewed';
  return `${churnCommits} commits/30d · ${lines} lines · ${coverage} · ${reviewed}`;
};

export interface CodeHealthCardProps {
  nightHealth: ProjectStats['nightHealth'];
}

export const CodeHealthCard = ({ nightHealth }: CodeHealthCardProps) => (
  <StatCard title="Code health">
    {nightHealth.chunks.length === 0 && <EmptyState message="No chunks found under src/." />}
    {nightHealth.chunks.map((chunk) => (
      <div key={chunk.path} className="flex flex-col gap-0.5">
        <StatRow
          label={chunk.path}
          value={
            <Stamp size="small" variant={scoreVariant(chunk.score)}>
              {chunk.score}
            </Stamp>
          }
        />
        <span className="text-2xs opacity-50">{formatSignals(chunk)}</span>
      </div>
    ))}
  </StatCard>
);
