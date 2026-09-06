import type { LogStats } from '@/core/log-stats';
import { formatDuration } from '@/core/phase-run';
import { Card } from '@dendelion/paper-ui';
import { formatCost } from '../helpers';

interface StatItemProps {
  label: string;
  value: string;
}

const StatItem = ({ label, value }: StatItemProps) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-handwritten text-xs font-semibold opacity-[0.55]">{label}</span>
    <span className="font-semibold text-lg">{value}</span>
  </div>
);

export interface LogStatsStripProps {
  stats: LogStats;
}

export const LogStatsStrip = ({ stats }: LogStatsStripProps) => (
  <Card size="small" texture="kraft" className="plan-row-card mb-4">
    <div className="flex flex-wrap items-center gap-6">
      <StatItem label="Runs" value={String(stats.runs)} />
      <StatItem label="Failed" value={String(stats.failed)} />
      <StatItem
        label="Success rate"
        value={stats.successRate == null ? '—' : `${Math.round(stats.successRate * 100)}%`}
      />
      <StatItem label="Total cost" value={formatCost(stats.totalCostUsd)} />
      <StatItem
        label="Median duration"
        value={stats.medianDurationMs == null ? '—' : formatDuration(stats.medianDurationMs)}
      />
    </div>
  </Card>
);
