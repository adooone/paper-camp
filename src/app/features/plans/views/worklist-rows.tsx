import type { FixRow, NoteRow, PlanSortKey, WorklistRow } from '@/app/features/plans/helpers';
import { useAppStore } from '@/app/stores/app-store';
import { MetaLine, NoteIcon, Row, Stamp, Switch } from '@dendelion/paper-ui';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, runningTaskForPlan } from '../helpers';
import { useWorklistRows } from '../hooks';
import { PLAN_ROW_COLUMNS, PlanRows, RowMarker } from './plan-rows';

interface WorklistRowsProps {
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
}

const headerLabelClass = 'font-handwritten text-sm opacity-60 whitespace-nowrap';

const subjectHeaderClass =
  'font-handwritten text-xs font-semibold opacity-55 leading-none pt-2 pr-1 pb-0 pl-1';

const groupToggleLabelClass = 'font-handwritten text-xs font-semibold opacity-55 leading-none';

const headerButtonClass = `${headerLabelClass} bg-none bg-transparent border-none p-0 cursor-pointer text-inherit text-left`;

const titleButtonClass =
  'flex items-center gap-2 min-w-0 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit';

const titleTextClass = 'overflow-hidden text-ellipsis whitespace-nowrap';

export const GroupBySubjectToggle = () => {
  const groupBySubject = useAppStore((s) => s.planFilters.groupBySubject);
  const toggleGroupBySubject = useAppStore((s) => s.toggleGroupBySubject);

  return (
    <div className="flex items-center gap-2">
      <span className={groupToggleLabelClass}>Group by subject</span>
      <Switch
        size="small"
        checked={groupBySubject}
        onChange={toggleGroupBySubject}
        aria-label="Group by subject"
      />
    </div>
  );
};

export const WorklistRows = ({
  rows,
  activePlanTitle,
  onOpenPlan,
  onOpenIdea,
}: WorklistRowsProps) => {
  const {
    roadmapItemNames,
    navigate,
    sortKey,
    sortDirection,
    handleSort,
    groups,
    showSubjectHeaders,
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
        />
      );
    }
    if (row.type === 'note') {
      return <NoteRowCard key={row.idea.title} row={row} onOpen={onOpenIdea} />;
    }
    return (
      <FixRowCard
        key={row.fix.title}
        row={row}
        activePlanTitle={activePlanTitle}
        onOpen={onOpenPlan}
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
            meta={
              <span className="flex items-center gap-2">
                {sortHeader('updated', 'Updated')}
                {sortHeader('progress', 'Progress')}
              </span>
            }
            trailing={sortHeader('status', 'Status')}
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
        : rows.map((row) => renderRow(row))}
    </div>
  );
};

interface NoteRowCardProps {
  row: NoteRow;
  onOpen?: (title: string) => void;
}

const NoteRowCard = ({ row, onOpen }: NoteRowCardProps) => {
  const idea = row.idea;
  const status = idea.status ?? 'open';
  return (
    <div className="flex items-center">
      <RowMarker order={idea.order} done={status === 'done'} status={status} />
      <div className="flex-1 min-w-0">
        <Row
          surface="card"
          columns={PLAN_ROW_COLUMNS}
          onClick={onOpen ? () => onOpen(idea.title) : undefined}
          ariaLabel={idea.title}
          id={idea.id ? <PlanIdStamp id={idea.id} /> : ''}
          title={
            <span className={titleButtonClass}>
              <NoteIcon />
              <span className={titleTextClass}>{idea.title}</span>
            </span>
          }
          meta={<MetaLine>—</MetaLine>}
          trailing={
            <Stamp size="small" variant={IDEA_STATUS_STAMP[status]}>
              {IDEA_STATUS_LABEL[status]}
            </Stamp>
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
}

const FixRowCard = ({ row, activePlanTitle, onOpen }: FixRowCardProps) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const fix = row.fix;
  const status = effectiveStatus(fix, agentStatus);
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
          onClick={onOpen ? () => onOpen(fix.title) : undefined}
          ariaLabel={fix.title}
          id={<PlanIdStamp id={fix.id} />}
          title={
            <span className={titleButtonClass}>
              <Stamp size="small" variant="warning">
                fix
              </Stamp>
              <span className={titleTextClass}>{fix.title}</span>
            </span>
          }
          meta={<MetaLine>{fix.idea ? `→ ${fix.idea}` : ''}</MetaLine>}
          trailing={
            <Stamp size="small" variant={STATUS_STAMP[status]}>
              {STATUS_LABEL[status]}
            </Stamp>
          }
        />
      </div>
    </div>
  );
};
