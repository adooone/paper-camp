import { formatDuration } from '@/core/phase-run';
import { EmptyState } from '@dendelion/paper-ui';
import { StatCard, StatRow } from './stat-card';

export interface MedianPhaseDurationCardProps {
  medianPhaseDurationMs: number | null;
}

export const MedianPhaseDurationCard = ({
  medianPhaseDurationMs,
}: MedianPhaseDurationCardProps) => (
  <StatCard title="Median phase duration">
    {medianPhaseDurationMs === null ? (
      <EmptyState message="No phase runs recorded yet." />
    ) : (
      <StatRow label="Median" value={formatDuration(medianPhaseDurationMs)} />
    )}
  </StatCard>
);
