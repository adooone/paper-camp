import type { FixRow, NoteRow, PlanSortKey, WorklistRow } from '@/app/features/plans/helpers';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import { entityPath } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import {
  ChevronRightIcon,
  MetaLine,
  NoteIcon,
  Row,
  type RowColumns,
  Stamp,
  Text,
  Tooltip,
} from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, relativeDate, runningTaskForPlan } from '../helpers';
import { useWorklistRows } from '../hooks';
import {
  PLAN_LIST_GRID,
  PLAN_ROW_COLUMNS,
  PLAN_ROW_HOST,
  PLAN_SUBGRID,
  PlanRows,
  RowIdCell,
  RowMarker,
  RowTitle,
  TrailingCells,
} from './plan-rows';

interface WorklistRowsProps {
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
  /** Opens an entity on another project's mount, scope kept — set only when the
   * scope holds more than one project (IDEA-291). */
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
}

const headerLabelClass = 'text-xs whitespace-nowrap';

const groupHeadingClass = 'font-handwritten text-base leading-none';

const GroupHeading = ({ children, count }: { children: ReactNode; count: number }) => (
  <div className="col-span-full flex items-baseline gap-2 px-1 pt-3 pb-1">
    {children}
    <span className="font-handwritten text-sm leading-none opacity-50">{count}</span>
  </div>
);

const headerButtonClass = `${headerLabelClass} flex items-center gap-1 bg-none bg-transparent border-none p-0 cursor-pointer text-inherit text-left`;

const titleButtonClass =
  'flex items-center gap-2 min-w-0 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit';

export const WorklistRows = ({
  rows,
  activePlanTitle,
  onOpenPlan,
  onOpenIdea,
  onOpenCrossProject,
}: WorklistRowsProps) => {
  const {
    roadmapItemNames,
    navigate,
    sortKey,
    sortDirection,
    handleSort,
    groups,
    showSubjectHeaders,
    projectGroups,
    showProjectHeaders,
    sortReflectsRows,
  } = useWorklistRows(rows);

  const renderRow = (row: WorklistRow) => {
    if (row.type === 'plan') {
      return (
        <PlanRows
          key={row.plan.title}
          plans={[row.plan]}
          activePlanTitle={activePlanTitle}
          onOpen={onOpenPlan}
          project={row.project}
          onOpenCrossProject={onOpenCrossProject}
          showProjectChip={!showProjectHeaders}
        />
      );
    }
    if (row.type === 'note') {
      return (
        <NoteRowCard
          key={row.idea.title}
          row={row}
          onOpen={onOpenIdea}
          onOpenCrossProject={onOpenCrossProject}
          showProjectChip={!showProjectHeaders}
        />
      );
    }
    return (
      <FixRowCard
        key={row.fix.title}
        row={row}
        activePlanTitle={activePlanTitle}
        onOpen={onOpenPlan}
        onOpenCrossProject={onOpenCrossProject}
        showProjectChip={!showProjectHeaders}
      />
    );
  };

  const sortHeader = (key: PlanSortKey, label: string, ariaLabel?: string) => {
    const active = key === sortKey;
    return (
      // biome-ignore lint/a11y/useSemanticElements: this grid cell is CSS-grid, not a <table>; a real <th> would need a <tr>/<table> ancestor.
      <span
        role="columnheader"
        aria-sort={
          sortReflectsRows && active
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : undefined
        }
      >
        <button
          type="button"
          className={`${headerButtonClass} ${active ? 'font-semibold' : 'opacity-60'}`}
          aria-label={ariaLabel}
          onClick={() => handleSort(key)}
        >
          {label}
          {active && (
            <span className={`flex ${sortDirection === 'asc' ? '-rotate-90' : 'rotate-90'}`}>
              <ChevronRightIcon size={12} />
            </span>
          )}
        </button>
      </span>
    );
  };

  return (
    <div className={PLAN_LIST_GRID}>
      <div className={PLAN_ROW_HOST}>
        <Row
          surface="card"
          texture="kraft"
          columns={PLAN_ROW_COLUMNS}
          className="h-8"
          id={
            <RowIdCell
              marker={
                <span className="flex w-6 shrink-0 justify-center">
                  {sortHeader('order', '#', 'Sort by run order')}
                </span>
              }
              id={sortHeader('id', 'Id')}
            />
          }
          title={sortHeader('title', 'Title')}
          meta={sortHeader('updated', 'Updated')}
          trailing={
            <TrailingCells
              progress={sortHeader('progress', 'Phases')}
              status={sortHeader('status', 'Status')}
            />
          }
        />
      </div>
      {showSubjectHeaders
        ? groups.map((group) => {
            const subject = group.subject;
            return (
              <div key={subject ?? '__no-subject__'} className={PLAN_SUBGRID}>
                <GroupHeading count={group.rows.length}>
                  {subject && roadmapItemNames.has(subject) ? (
                    <button
                      type="button"
                      className={`${groupHeadingClass} bg-none bg-transparent border-none p-0 cursor-pointer text-left text-inherit hover:underline`}
                      title="View in roadmap"
                      onClick={() =>
                        navigate({ to: '/project/roadmap/$item', params: { item: subject } })
                      }
                    >
                      {subject}
                    </button>
                  ) : (
                    <span className={groupHeadingClass}>{subject ?? 'No subject'}</span>
                  )}
                </GroupHeading>
                {group.rows.map((row) => renderRow(row))}
              </div>
            );
          })
        : showProjectHeaders
          ? projectGroups.map((group) => (
              <div key={group.project?.key ?? '__current__'} className={PLAN_SUBGRID}>
                <GroupHeading count={group.rows.length}>
                  <span className={groupHeadingClass}>{group.project?.name ?? 'This project'}</span>
                </GroupHeading>
                {group.rows.map((row) => renderRow(row))}
              </div>
            ))
          : rows.map((row) => renderRow(row))}
    </div>
  );
};

interface NoteRowCardProps {
  row: NoteRow;
  onOpen?: (title: string) => void;
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
  showProjectChip: boolean;
}

const NoteRowCard = ({ row, onOpen, onOpenCrossProject, showProjectChip }: NoteRowCardProps) => {
  const idea = row.idea;
  const status = idea.status ?? 'open';
  const foreign = row.project && !row.project.isCurrent ? row.project : undefined;
  const handleOpen =
    foreign && onOpenCrossProject
      ? () => onOpenCrossProject(foreign, entityPath({ id: idea.id, title: idea.title }))
      : onOpen
        ? () => onOpen(idea.title)
        : undefined;
  return (
    <div className={PLAN_ROW_HOST}>
      <Row
        surface="card"
        columns={PLAN_ROW_COLUMNS}
        onClick={handleOpen}
        ariaLabel={idea.title}
        id={
          <RowIdCell
            marker={<RowMarker order={idea.order} done={status === 'done'} status={status} />}
            id={idea.id ? <PlanIdStamp id={idea.id} fill /> : null}
          />
        }
        title={
          <span className={titleButtonClass}>
            <NoteIcon opacity={0.55} />
            <RowTitle
              extras={row.project && showProjectChip && <ProjectChip project={row.project} />}
            >
              {idea.title}
            </RowTitle>
          </span>
        }
        meta={<MetaLine>—</MetaLine>}
        trailing={
          <TrailingCells
            progress={
              <Text face="serif" size="base" className="opacity-30">
                —
              </Text>
            }
            status={
              <Stamp size="small" variant={IDEA_STATUS_STAMP[status]}>
                {IDEA_STATUS_LABEL[status]}
              </Stamp>
            }
          />
        }
      />
    </div>
  );
};

interface FixRowCardProps {
  row: FixRow;
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
  showProjectChip: boolean;
}

const FixRowCard = ({
  row,
  activePlanTitle,
  onOpen,
  onOpenCrossProject,
  showProjectChip,
}: FixRowCardProps) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const fix = row.fix;
  const status = effectiveStatus(fix, agentStatus);
  const foreign = row.project && !row.project.isCurrent ? row.project : undefined;
  const handleOpen =
    foreign && onOpenCrossProject
      ? () => onOpenCrossProject(foreign, entityPath(fix))
      : onOpen
        ? () => onOpen(fix.title)
        : undefined;
  return (
    <div className={PLAN_ROW_HOST}>
      <Row
        surface="card"
        columns={PLAN_ROW_COLUMNS}
        highlighted={fix.title === activePlanTitle}
        onClick={handleOpen}
        ariaLabel={fix.title}
        id={
          <RowIdCell
            marker={
              <RowMarker
                order={fix.order}
                done={fix.status === 'done'}
                status={fix.status}
                running={Boolean(runningTaskForPlan(fix.id, agentStatus))}
                fallback={fix.statusFallback}
              />
            }
            id={<PlanIdStamp id={fix.id} fill />}
          />
        }
        title={
          <span className={titleButtonClass}>
            <Tooltip content={fix.idea ? `Fixes ${fix.idea}` : 'Fix'}>
              <Stamp size="small" variant="warning">
                fix
              </Stamp>
            </Tooltip>
            <RowTitle
              extras={row.project && showProjectChip && <ProjectChip project={row.project} />}
            >
              {fix.title}
            </RowTitle>
          </span>
        }
        meta={
          <MetaLine className="whitespace-nowrap">
            {fix.updated ? relativeDate(fix.updated) : relativeDate(fix.created)}
          </MetaLine>
        }
        trailing={
          <TrailingCells
            progress={null}
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
};
