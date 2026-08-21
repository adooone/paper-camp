import { formatDuration, formatTokens } from '@/core/phase-run';
import { Checkbox, Spinner, Stamp } from '@dendelion/paper-ui';
import { AgentStartButton } from '../actions/agent-start-button';
import { STATUS_STAMP } from '../constants';
import { type WorkRow, isRunningRow } from '../helpers';
import type { RunningPhaseFill } from '../hooks';

export const PhaseCheckboxCell = ({
  row,
  runningFill,
  updating,
  onTogglePhase,
  onToggleFix,
}: {
  row: WorkRow;
  runningFill: RunningPhaseFill | null;
  updating: boolean;
  onTogglePhase: (index: number) => void;
  onToggleFix: (index: number) => void;
}) =>
  isRunningRow(row, runningFill) ? (
    <Spinner size="small" />
  ) : (
    <Checkbox
      checked={row.item.done}
      onChange={() => (row.kind === 'phase' ? onTogglePhase(row.index) : onToggleFix(row.index))}
      disabled={updating}
    />
  );

export const PhaseTitleCell = ({
  row,
  runningFill,
}: {
  row: WorkRow;
  runningFill: RunningPhaseFill | null;
}) => (
  <span
    className={`inline-flex min-w-0 max-w-full items-center gap-2 ${row.item.done ? 'line-through opacity-[0.45]' : 'no-underline'}`}
  >
    <span
      title={row.item.text}
      className="overflow-hidden text-ellipsis whitespace-nowrap font-handwritten text-base leading-tight"
    >
      {row.item.text}
    </span>
    {isRunningRow(row, runningFill) && (
      <span className="text-xs opacity-[0.55]">
        {Math.round((runningFill?.fraction ?? 0) * 100)}%
      </span>
    )}
    {row.kind === 'phase' && row.item.source === 'review' && (
      <Stamp size="small" fillColor={STATUS_STAMP.review.fill} textColor={STATUS_STAMP.review.text}>
        review
      </Stamp>
    )}
    {row.kind === 'phase' && row.item.source === 'manual' && (
      <Stamp size="small" variant="neutral">
        manual
      </Stamp>
    )}
    {row.kind === 'fix' && (
      <Stamp size="small" variant="warning">
        fix
      </Stamp>
    )}
  </span>
);

export const PhaseActionsCell = ({
  row,
  runningFill,
  agentBusy,
  planId,
}: {
  row: WorkRow;
  runningFill: RunningPhaseFill | null;
  agentBusy: boolean;
  planId: string | undefined;
}) => {
  if (isRunningRow(row, runningFill)) return null;
  if (row.item.done) {
    const run = row.item.run;
    if (!run) return null;
    return (
      <div className="flex w-full justify-end [container-type:inline-size]">
        <Stamp size="small" fillColor="var(--pui-texture-shade)" textColor="inherit">
          <span className="whitespace-nowrap font-mono text-3xs font-normal opacity-[0.7]">
            <span>{formatTokens(run.inputTokens + run.outputTokens)} tokens</span>
            <span className="run-meta-full">
              {' '}
              · {formatDuration(run.durationMs)}
              {run.attempts > 1 && ` ×${run.attempts}`}
              {run.model && ` · ${run.model}`}
            </span>
          </span>
        </Stamp>
      </div>
    );
  }
  if (row.kind !== 'phase') return null;
  return (
    <div className="flex justify-end">
      <AgentStartButton planId={planId} phaseIndex={row.index} disabled={agentBusy} />
    </div>
  );
};
