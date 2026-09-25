import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import {
  LightbulbIcon,
  MergeIcon,
  MetaLine,
  Row,
  type RowColumns,
  Spinner,
  Stamp,
  Tooltip,
} from '@dendelion/paper-ui';
import { color, colors } from '@dendelion/paper-ui/tokens';
import { PlanIdStamp } from '../components';
import { PR_STATE_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
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
        <Stamp size="small" fillColor={colors.surfaceOverlay}>
          <span className="font-handwritten text-xs leading-none">{order}</span>
        </Stamp>
      )
    ) : status === 'idea' ? (
      // Run order only covers planned/in-progress/review, so a backlog idea has no
      // number to show — mark it as unplanned rather than leaving the gutter blank.
      <span aria-label="Backlog — not planned yet" className="inline-flex text-ink-300">
        <LightbulbIcon size={14} opacity={0.55} />
      </span>
    ) : null}
  </span>
);

/** Shared by every row in the plans/worklist lists (plan, note and fix rows)
 * so a header built from the same columns lines up with all three. */
export const PLAN_ROW_COLUMNS: RowColumns = {
  id: '76px',
  title: 'minmax(0,1fr)',
  meta: '110px',
  trailing: '92px',
};

export const PlanRows = ({ plans, activePlanTitle, onOpen }: PlanRowsProps) => {
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
            <div className="flex-1 min-w-0">
              <Row
                surface="card"
                columns={PLAN_ROW_COLUMNS}
                highlighted={plan.title === activePlanTitle}
                onClick={onOpen ? () => onOpen(plan.title) : undefined}
                ariaLabel={plan.title}
                id={<PlanIdStamp id={plan.id} />}
                title={plan.title}
                meta={
                  <MetaLine>
                    {plan.updated ? relativeDate(plan.updated) : relativeDate(plan.created)}
                    {progress ? ` · ${progress.done}/${progress.total}` : ''}
                  </MetaLine>
                }
                trailing={
                  <>
                    <Stamp size="small" variant={STATUS_STAMP[status]}>
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
                        <span className="inline-flex" style={{ color: color.accentPurpleDark }}>
                          <MergeIcon size={14} />
                        </span>
                      </Tooltip>
                    )}
                  </>
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
