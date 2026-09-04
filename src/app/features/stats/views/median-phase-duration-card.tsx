import { EmptyState } from '@/app/components';
import { formatDuration } from '@/core/phase-run';
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
