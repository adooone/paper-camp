import { LightbulbIcon, MergeIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Card, Spinner, Stamp, Tooltip } from '@dendelion/paper-ui';
import { PlanIdStamp, ProgressBar } from '../components';
import { PR_STATE_STAMP, STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, phaseProgress, relativeDate, runningTaskForPlan } from '../helpers';

interface PlanRowsProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
}

interface RowMarkerProps {
  order?: number;
  done?: boolean;
  running?: boolean;
  status?: string;
  /** Queue position was computed from a status guess (GitHub unreachable) — see plan.statusFallback. */
  fallback?: boolean;
}

/** The gutter outside a row card: spinner while an agent works, run-order stamp, a check for done, or blank. */
export const RowMarker = ({ order, done, running, status, fallback }: RowMarkerProps) => (
  <span className="flex-[0_0_36px] flex items-center justify-center">
    {running ? (
      <Spinner size="small" label="Agent running" />
    ) : done ? (
      <span aria-label="Done" className="text-watercolor-green-dark text-sm">
        ✓
      </span>
    ) : order !== undefined ? (
      fallback ? (
        <Tooltip content="Queue position based on a status guess — GitHub's PR state couldn't be resolved">
          <Stamp size="small" variant="warning" dot>
            <span className="font-handwritten text-xs leading-none">{order}</span>
          </Stamp>
        </Tooltip>
      ) : (
        <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
          <span className="font-handwritten text-xs leading-none">{order}</span>
        </Stamp>
      )
    ) : status === 'idea' ? (
      // Run order only covers planned/in-progress/review, so a backlog idea has no
      // number to show — mark it as unplanned rather than leaving the gutter blank.
      <span aria-label="Backlog — not planned yet" className="inline-flex text-ink-300">
        <LightbulbIcon size={14} />
      </span>
    ) : null}
  </span>
);

// Built from Cards, not paper-ui's Table, sharing the plan rows grid column
// template so the header and rows line up. Exported so PlansListSkeleton can
// match this exact column shape.
export const PLAN_ROWS_GRID_CLASS =
  'grid grid-cols-[76px_minmax(0,1fr)_84px_96px_112px] gap-2.5 items-center max-lg:grid-cols-[76px_minmax(0,1fr)_96px_112px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

export const PlanRows = ({ plans, activePlanTitle, onOpen }: PlanRowsProps) => {
  const gridClass = PLAN_ROWS_GRID_CLASS;
  const agentStatus = useAppStore((s) => s.agentStatus);
  return (
    <div className="flex flex-col gap-1">
      {plans.map((plan) => {
        const progress = phaseProgress(plan);
        const status = effectiveStatus(plan, agentStatus);
        return (
          <div key={plan.title} className="flex items-center">
            <RowMarker
              order={plan.order}
              done={plan.status === 'done'}
              status={plan.status}
              running={Boolean(runningTaskForPlan(plan.id, agentStatus))}
              fallback={plan.statusFallback}
            />
            <div
              role={onOpen ? 'button' : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onClick={onOpen ? () => onOpen(plan.title) : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(plan.title);
                      }
                    }
                  : undefined
              }
              className={`${onOpen ? 'cursor-pointer' : ''} rounded-[10px] flex-1 min-w-0 ${plan.title === activePlanTitle ? 'plan-row-highlighted outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]' : ''}`}
            >
              <Card size="small" texture="canvas" className="plan-row-card">
                <div className={gridClass}>
                  <PlanIdStamp id={plan.id} />
                  <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {plan.title}
                  </span>
                  <span className="max-lg:hidden text-sm opacity-[0.45] whitespace-nowrap">
                    {plan.updated ? relativeDate(plan.updated) : relativeDate(plan.created)}
                  </span>
                  {progress ? (
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <ProgressBar pct={progress.pct} color={STATUS_COLOR[status]} />
                      </div>
                      <span className="text-sm opacity-50 shrink-0">
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm opacity-30">—</span>
                  )}
                  <div className="flex items-center gap-1">
                    <Stamp
                      size="small"
                      fillColor={STATUS_STAMP[status].fill}
                      textColor={STATUS_STAMP[status].text}
                    >
                      {STATUS_LABEL[status]}
                    </Stamp>
                    {plan.statusFallback && (
                      <Tooltip content="GitHub's PR state couldn't be resolved — this status is a guess from local data">
                        <Stamp size="small" variant="warning" dot>
                          Guess
                        </Stamp>
                      </Tooltip>
                    )}
                    {plan.pr?.state === 'merged' && (
                      <Tooltip content={`Merged in #${plan.pr.number}`}>
                        <span className="inline-flex text-[#7B5E9E]">
                          <MergeIcon size={14} />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
};
