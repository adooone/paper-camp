import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import { entityLink, entityPath } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { isBlockingNeed } from '@/core/needs-status';
import type { PlanEntry } from '@/types/index';
import {
  LightbulbIcon,
  MergeIcon,
  MetaLine,
  Row,
  type RowColumns,
  Spinner,
  Stamp,
  Text,
  Tooltip,
} from '@dendelion/paper-ui';
import { color, colors } from '@dendelion/paper-ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { PlanIdStamp } from '../components';
import { PR_STATE_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, phaseProgress, relativeDate, runningTaskForPlan } from '../helpers';

interface PlanRowsProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
  /** Set only on a single-plan row produced by the scope merge — chip + cross-mount
   * navigation apply to that one plan (IDEA-291). */
  project?: ScopeRow;
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
  /** Off under Group by Project, where the group heading already names it. */
  showProjectChip?: boolean;
}

interface RowMarkerProps {
  order?: number;
  done?: boolean;
  running?: boolean;
  status?: string;
  /** Queue position was computed from a status guess (GitHub unreachable) — see plan.statusFallback. */
  fallback?: boolean;
}

/** The first cell of a row's id column: spinner while an agent works, run-order stamp, a check for done, or blank. */
export const RowMarker = ({ order, done, running, status, fallback }: RowMarkerProps) => (
  <span className="flex w-6 shrink-0 items-center justify-center">
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

/** Each row's own template, used only where a row stands outside a PLAN_LIST_GRID
 * (the loading skeleton); inside one, rows take the list's shared columns instead. */
export const PLAN_ROW_COLUMNS: RowColumns = {
  id: '124px',
  title: 'minmax(0,1fr)',
  meta: { width: '64px', hideBelow: 'lg' },
  trailing: '156px',
};

/** One grid for the header and every row: id, meta and trailing are as wide as their
 * widest cell, the title takes the rest. Rows join it through PLAN_ROW_HOST. The
 * 1025px step matches Row's hideBelow="lg", which drops the meta cell below it. */
export const PLAN_LIST_GRID =
  'grid gap-x-2.5 gap-y-1 grid-cols-[max-content_minmax(0,1fr)_max-content] min-[1025px]:grid-cols-[max-content_minmax(0,1fr)_max-content_max-content]';

/** A block inside the list grid (a group, a heading) that keeps its children on the list's columns. */
export const PLAN_SUBGRID = 'col-span-full grid grid-cols-subgrid gap-y-1';

/** Wraps a card Row so it sits on the list's columns: Row puts its grid inside a
 * bordered wrapper, so both levels subgrid. The trailing cell stretches to its column
 * so progress and status line up at its two ends. */
export const PLAN_ROW_HOST = [
  'col-span-full grid grid-cols-subgrid',
  '[&>div]:col-span-full [&>div]:grid [&>div]:grid-cols-subgrid',
  '[&>div>div:last-child]:col-span-full [&>div>div:last-child]:grid-cols-subgrid',
  '[&>div>div:last-child>div:last-child]:justify-self-stretch [&>div>div:last-child>div:last-child]:ml-0',
].join(' ');

export const TrailingCells = ({ progress, status }: { progress: ReactNode; status: ReactNode }) => (
  <span className="flex w-full items-center justify-between gap-3">
    <span className="flex shrink-0">{progress}</span>
    <span className="flex shrink-0">{status}</span>
  </span>
);

/** The id column: the run-order marker, then the id stamp. */
export const RowIdCell = ({ marker, id }: { marker: ReactNode; id: ReactNode }) => (
  <span className="flex items-center gap-2">
    {marker}
    <span className="shrink-0">{id}</span>
  </span>
);

/** A title that truncates before the stamps beside it do. */
export const RowTitle = ({ children, extras }: { children: ReactNode; extras?: ReactNode }) => (
  <span className="flex min-w-0 items-center gap-2">
    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    {extras && <span className="flex shrink-0 items-center gap-1.5">{extras}</span>}
  </span>
);

export const PlanRows = ({
  plans,
  activePlanTitle,
  onOpen,
  project,
  onOpenCrossProject,
  showProjectChip = true,
}: PlanRowsProps) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const navigate = useNavigate();
  const foreign = project && !project.isCurrent ? project : undefined;
  return (
    <div className={PLAN_SUBGRID}>
      {plans.map((plan) => {
        const progress = phaseProgress(plan);
        const status = effectiveStatus(plan, agentStatus);
        const blockingNeed = plan.resolvedNeeds?.find(isBlockingNeed);
        const deadNeed = blockingNeed ? undefined : plan.resolvedNeeds?.find((n) => !n.found);
        const handleOpen =
          foreign && onOpenCrossProject
            ? () => onOpenCrossProject(foreign, entityPath(plan))
            : onOpen
              ? () => onOpen(plan.title)
              : undefined;
        return (
          <div key={plan.title} className={PLAN_ROW_HOST}>
            <Row
              surface="card"
              columns={PLAN_ROW_COLUMNS}
              highlighted={plan.title === activePlanTitle}
              onClick={handleOpen}
              ariaLabel={plan.title}
              id={
                <RowIdCell
                  marker={
                    <RowMarker
                      order={plan.order}
                      done={plan.status === 'done'}
                      status={plan.status}
                      running={Boolean(runningTaskForPlan(plan.id, agentStatus))}
                      fallback={plan.statusFallback}
                    />
                  }
                  id={<PlanIdStamp id={plan.id} fill />}
                />
              }
              title={
                <RowTitle
                  extras={
                    (project && showProjectChip) ||
                    blockingNeed ||
                    deadNeed ||
                    plan.statusFallback ||
                    plan.pr?.state === 'merged' ? (
                      <>
                        {project && showProjectChip && <ProjectChip project={project} />}
                        {blockingNeed && (
                          <Tooltip
                            content={`Waits for ${blockingNeed.projectName ? `${blockingNeed.projectName} ` : ''}${blockingNeed.id}`}
                          >
                            <Stamp
                              size="small"
                              variant="warning"
                              dot
                              // A cross-project need has no mount to navigate to yet, so it
                              // isn't a link — the tooltip still names it.
                              onClick={
                                blockingNeed.projectSlug
                                  ? undefined
                                  : (e) => {
                                      e.stopPropagation();
                                      navigate(
                                        entityLink({
                                          id: blockingNeed.id,
                                          title: blockingNeed.title ?? blockingNeed.id,
                                        }),
                                      );
                                    }
                              }
                            >
                              Waits
                            </Stamp>
                          </Tooltip>
                        )}
                        {deadNeed && (
                          <Tooltip content={`Can't find ${deadNeed.raw}`}>
                            <Stamp size="small" variant="error" dot>
                              Needs
                            </Stamp>
                          </Tooltip>
                        )}
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
                    ) : undefined
                  }
                >
                  {plan.title}
                </RowTitle>
              }
              meta={
                <MetaLine className="whitespace-nowrap">
                  {plan.updated ? relativeDate(plan.updated) : relativeDate(plan.created)}
                </MetaLine>
              }
              trailing={
                <TrailingCells
                  progress={
                    progress ? (
                      <MetaLine className="whitespace-nowrap">
                        {progress.done}/{progress.total}
                      </MetaLine>
                    ) : (
                      <Text face="serif" size="base" className="opacity-30">
                        —
                      </Text>
                    )
                  }
                  status={
                    <Stamp size="small" variant={STATUS_STAMP[status]}>
                      {STATUS_LABEL[status]}
                    </Stamp>
                  }
                />
              }
            />
          </div>
        );
      })}
    </div>
  );
};
