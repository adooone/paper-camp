import type { LogRow } from '../types/index';

export interface LogStats {
  runs: number;
  failed: number;
  successRate: number | undefined;
  totalCostUsd: number;
  medianDurationMs: number | undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeLogStats(rows: LogRow[]): LogStats {
  const runRows = rows.filter((row) => row.source.kind === 'task' || row.source.kind === 'running');
  const done = runRows.filter((row) => row.outcome === 'done').length;
  const failed = runRows.filter((row) => row.outcome === 'error').length;
  const settled = done + failed;
  const totalCostUsd = runRows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const durations = runRows.map((row) => row.durationMs).filter((ms): ms is number => ms != null);
  return {
    runs: runRows.length,
    failed,
    successRate: settled > 0 ? done / settled : undefined,
    totalCostUsd,
    medianDurationMs: median(durations),
  };
}
