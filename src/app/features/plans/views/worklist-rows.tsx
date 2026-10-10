import type { FixRow, NoteRow, PlanSortKey, WorklistRow } from '@/app/features/plans/helpers';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import { entityPath } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { MetaLine, NoteIcon, Row, Stamp, Text } from '@dendelion/paper-ui';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, relativeDate, runningTaskForPlan } from '../helpers';
import { useWorklistRows } from '../hooks';
import { PLAN_ROW_COLUMNS, PlanRows, RowMarker } from './plan-rows';

interface WorklistRowsProps {
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
  /** Opens an entity on another project's mount, scope kept — set only when the
   * scope holds more than one project (IDEA-291). */
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
}

const headerLabelClass = 'font-handwritten text-sm opacity-60 whitespace-nowrap';

const subjectHeaderClass =
  'font-handwritten text-xs font-semibold opacity-55 leading-none pt-2 pr-1 pb-0 pl-1';

const headerButtonClass = `${headerLabelClass} bg-none bg-transparent border-none p-0 cursor-pointer text-inherit text-left`;

const titleButtonClass =
  'flex items-center gap-2 min-w-0 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit';

const titleTextClass = 'overflow-hidden text-ellipsis whitespace-nowrap';

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
      />
    );
  };

  const sortHeader = (key: PlanSortKey, label: string) => {
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
        <button type="button" className={headerButtonClass} onClick={() => handleSort(key)}>
          {label}
          {active && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
        </button>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* biome-ignore lint/a11y/useSemanticElements: this gutter sits outside the row grid, not inside a <table>; a real <th> would need a <tr>/<table> ancestor. */}
        <span
          role="columnheader"
          className="flex-[0_0_36px] flex justify-center"
          aria-sort={
            sortReflectsRows && sortKey === 'order'
              ? sortDirection === 'asc'
                ? 'ascending'
                : 'descending'
              : undefined
          }
        >
          <button
            type="button"
            className={headerButtonClass}
            aria-label="Sort by run order"
            onClick={() => handleSort('order')}
          >
            #{sortKey === 'order' && (sortDirection === 'asc' ? '▲' : '▼')}
          </button>
        </span>
        <div className="flex-1 min-w-0">
          <Row
            surface="card"
            columns={PLAN_ROW_COLUMNS}
            id={sortHeader('id', 'Id')}
            title={sortHeader('title', 'Title')}
            meta={sortHeader('updated', 'Updated')}
            trailing={
              <span className="flex items-center gap-2">
                {sortHeader('progress', 'Progress')}
                {sortHeader('status', 'Status')}
              </span>
            }
          />
        </div>
      </div>
      {showSubjectHeaders
        ? groups.map((group) => {
            const subject = group.subject;
            return (
              <div key={subject ?? '__no-subject__'} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  {subject && roadmapItemNames.has(subject) ? (
                    <button
                      type="button"
                      className={`${subjectHeaderClass} bg-none bg-transparent border-none cursor-pointer text-left hover:underline`}
                      title="View in roadmap"
                      onClick={() => navigate({ to: '/roadmap', search: { item: subject } })}
                    >
                      {subject}
                    </button>
                  ) : (
                    <div className={subjectHeaderClass}>{subject ?? 'No subject'}</div>
                  )}
                </div>
                {group.rows.map((row) => renderRow(row))}
              </div>
            );
          })
        : showProjectHeaders
          ? projectGroups.map((group) => (
              <div key={group.project?.key ?? '__current__'} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  {group.project ? (
                    <ProjectChip project={group.project} />
                  ) : (
                    <div className={subjectHeaderClass}>This project</div>
                  )}
                </div>
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
}

const NoteRowCard = ({ row, onOpen, onOpenCrossProject }: NoteRowCardProps) => {
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
    <div className="flex items-center">
      <RowMarker order={idea.order} done={status === 'done'} status={status} />
      <div className="flex-1 min-w-0">
        <Row
          surface="card"
          columns={PLAN_ROW_COLUMNS}
          onClick={handleOpen}
          ariaLabel={idea.title}
          id={idea.id ? <PlanIdStamp id={idea.id} fill /> : ''}
          title={
            <span className={titleButtonClass}>
              <NoteIcon opacity={0.55} />
              <span className={titleTextClass}>{idea.title}</span>
            </span>
          }
          meta={<MetaLine>—</MetaLine>}
          trailing={
            <>
              {row.project && <ProjectChip project={row.project} />}
              <Text face="serif" size="base" className="opacity-30">
                —
              </Text>
              <Stamp size="small" variant={IDEA_STATUS_STAMP[status]}>
                {IDEA_STATUS_LABEL[status]}
              </Stamp>
            </>
          }
        />
      </div>
    </div>
  );
};

interface FixRowCardProps {
  row: FixRow;
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
  onOpenCrossProject?: (project: ScopeRow, path: string) => void;
}

const FixRowCard = ({ row, activePlanTitle, onOpen, onOpenCrossProject }: FixRowCardProps) => {
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
    <div className="flex items-center">
      <RowMarker
        order={fix.order}
        done={fix.status === 'done'}
        status={fix.status}
        running={Boolean(runningTaskForPlan(fix.id, agentStatus))}
        fallback={fix.statusFallback}
      />
      <div className="flex-1 min-w-0">
        <Row
          surface="card"
          columns={PLAN_ROW_COLUMNS}
          highlighted={fix.title === activePlanTitle}
          onClick={handleOpen}
          ariaLabel={fix.title}
          id={<PlanIdStamp id={fix.id} fill />}
          title={
            <span className={titleButtonClass}>
              <Stamp size="small" variant="warning">
                fix
              </Stamp>
              <span className={`${titleTextClass} min-w-0 flex-1`}>{fix.title}</span>
              {fix.idea && (
                <Text face="mono" size="xs" tone="faint" noWrap>
                  {fix.idea}
                </Text>
              )}
            </span>
          }
          meta={
            <MetaLine className="whitespace-nowrap">
              {fix.updated ? relativeDate(fix.updated) : relativeDate(fix.created)}
            </MetaLine>
          }
          trailing={
            <>
              {row.project && <ProjectChip project={row.project} />}
              <Stamp size="small" variant={STATUS_STAMP[status]}>
                {STATUS_LABEL[status]}
              </Stamp>
            </>
          }
        />
      </div>
    </div>
  );
};
