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
      <p className="opacity-50 m-0">No phase runs recorded yet.</p>
    ) : (
      <StatRow label="Median" value={formatDuration(medianPhaseDurationMs)} />
    )}
  </StatCard>
);
