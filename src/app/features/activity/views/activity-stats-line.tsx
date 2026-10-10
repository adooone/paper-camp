import { formatDuration } from '@/core/phase-run';
import type { LogStats } from '@/core/run-stats';
import { formatCost } from '../helpers';

export interface ActivityStatsLineProps {
  stats: LogStats;
}

export const ActivityStatsLine = ({ stats }: ActivityStatsLineProps) => (
  <p className="mb-4 font-handwritten text-xs opacity-55">
    {stats.runs} runs · {stats.failed} failed ·{' '}
    {stats.successRate == null ? '—' : `${Math.round(stats.successRate * 100)}%`} success ·{' '}
    {formatCost(stats.totalCostUsd)} total ·{' '}
    {stats.medianDurationMs == null ? '—' : formatDuration(stats.medianDurationMs)} median
  </p>
);
