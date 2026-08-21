import { type UsageRollup, formatDuration, formatTokens } from '@/core/phase-run';
import { Stamp, Tooltip } from '@dendelion/paper-ui';

// Same stamp as a phase row's run cost, and the same three-item shape — the
// rollup swaps the phase's single model for a run count.
interface RunCostSummaryProps {
  rollup: UsageRollup;
}

export const RunCostSummary = ({ rollup }: RunCostSummaryProps) => {
  if (rollup.runs === 0) return null;
  return (
    // shrink-0: the stamp sets its own width from nowrap text, so letting flex
    // squeeze it just pushes the text past the sheet's edge.
    <span className="shrink-0">
      <Tooltip
        content={`${formatTokens(rollup.inputTokens)} in · ${formatTokens(rollup.outputTokens)} out · cache ${formatTokens(rollup.cacheCreationTokens)} write · ${formatTokens(rollup.cacheReadTokens)} read`}
      >
        <Stamp size="small" fillColor="var(--pui-texture-shade)" textColor="inherit">
          <span className="whitespace-nowrap font-mono text-3xs font-normal opacity-[0.7]">
            {formatTokens(rollup.inputTokens + rollup.outputTokens)} tokens ·{' '}
            {formatDuration(rollup.durationMs)} · {rollup.runs} {rollup.runs === 1 ? 'run' : 'runs'}
          </span>
        </Stamp>
      </Tooltip>
    </span>
  );
};
