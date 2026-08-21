import type { UsageRollup } from '@/core/phase-run';
import { ProgressBar } from '../components';
import { RunCostSummary } from './run-cost-summary';

interface PlanProgressRowProps {
  progress: { pct: number; done: number; total: number } | null;
  color: string;
  rollup: UsageRollup;
}

export const PlanProgressRow = ({ progress, color: barColor, rollup }: PlanProgressRowProps) => {
  if (progress === null && rollup.runs === 0) return null;
  return (
    // min-w-min, not a fixed rem: the cost stamp's width depends on its numbers, so
    // only min-content knows when the bar has hit its floor and the strip must wrap.
    // A guessed rem value either wraps too eagerly or lets the stamp overflow.
    <div className="flex items-center gap-3 flex-1 min-w-min">
      {progress !== null && (
        <>
          <div className="flex-1 min-w-16">
            <ProgressBar pct={progress.pct} color={barColor} />
          </div>
          <span className="text-sm opacity-50 flex-shrink-0 font-handwritten">
            {Math.round(progress.pct)}%
          </span>
        </>
      )}
      <RunCostSummary rollup={rollup} />
    </div>
  );
};
