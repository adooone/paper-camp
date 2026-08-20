import { NoteIcon } from '@/app/components/icons';
import type { FixRow, NoteRow, PlanSortKey, WorklistRow } from '@/app/features/plans/helpers';
import { groupRowsBySubject } from '@/app/features/plans/helpers';
import { useRoadmapItemNames } from '@/app/features/roadmap';
import { useSubjectVocabulary } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { Card, Stamp, Switch } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, runningTaskForPlan } from '../helpers';
import { PlanRows, ROW_MARKER_WIDTH, RowMarker } from './plan-rows';

interface WorklistRowsProps {
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
}

const headerLabelClass = 'text-sm font-semibold opacity-60 whitespace-nowrap overflow-hidden';

const PLAN_ROWS_GRID_CLASS =
  'grid grid-cols-[76px_minmax(0,1fr)_84px_96px_112px] gap-2.5 items-center max-lg:grid-cols-[76px_minmax(0,1fr)_96px_112px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

const subjectHeaderClass =
  'font-handwritten text-xs font-semibold opacity-55 leading-none pt-2 pr-1 pb-0 pl-1';

const groupToggleLabelClass = 'font-handwritten text-xs font-semibold opacity-55 leading-none';

const headerButtonClass = `${headerLabelClass} bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left`;

const SORT_COLUMNS: { key: PlanSortKey; label: string }[] = [
  { key: 'id', label: 'Id' },
  { key: 'title', label: 'Title' },
  { key: 'updated', label: 'Updated' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

const titleButtonClass =
  'flex items-center gap-2 min-w-0 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit font-semibold';

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
    subjects: validSubjects,
    loading: subjectsLoading,
    available: subjectsAvailable,
  } = useSubjectVocabulary();
  const roadmapItemNames = useRoadmapItemNames();
  const navigate = useNavigate();
  const gridClass = PLAN_ROWS_GRID_CLASS;
  const sortKey = useAppStore((s) => s.planFilters.sortKey);
  const sortDirection = useAppStore((s) => s.planFilters.sortDirection);
  const groupBySubject = useAppStore((s) => s.planFilters.groupBySubject);
  const setPlanSortKey = useAppStore((s) => s.setPlanSortKey);
  const togglePlanSortDirection = useAppStore((s) => s.togglePlanSortDirection);

  const handleSort = (key: PlanSortKey) => {
    if (key === sortKey) togglePlanSortDirection();
    else setPlanSortKey(key);
  };

  const renderRow = (row: WorklistRow) => {
    if (row.type === 'plan') {
      return (
        <PlanRows
          key={row.plan.title}
          plans={[row.plan]}
          activePlanTitle={activePlanTitle}
          onOpen={onOpenPlan}
          showHeader={false}
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

  const groups = groupRowsBySubject(
    rows,
    sortDirection,
    subjectsLoading || !subjectsAvailable ? undefined : validSubjects,
  );
  const showSubjectHeaders = groupBySubject && groups.length > 1;
  const sortReflectsRows = !showSubjectHeaders;

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
          <Card size="small" texture="kraft" className="plan-row-card">
            <div className={gridClass}>
              {SORT_COLUMNS.map(({ key, label }) => {
                const active = key === sortKey;
                return (
                  <span
                    // biome-ignore lint/a11y/useSemanticElements: this grid row is CSS-grid, not a <table>; a real <th> would need a <tr>/<table> ancestor.
                    key={key}
                    role="columnheader"
                    className={key === 'updated' ? 'max-lg:hidden' : undefined}
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
                      className={headerButtonClass}
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      {active && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </button>
                  </span>
                );
              })}
            </div>
          </Card>
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

const NoteRowCard = ({
  row,
  onOpen,
}: {
  row: NoteRow;
  onOpen?: (title: string) => void;
}) => {
  const idea = row.idea;
  const status = idea.status ?? 'open';
  return (
    <div className="flex items-center">
      <RowMarker order={idea.order} done={status === 'done'} status={status} />
      <div
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen ? () => onOpen(idea.title) : undefined}
        onKeyDown={
          onOpen
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(idea.title);
                }
              }
            : undefined
        }
        className={`${onOpen ? 'cursor-pointer' : ''} rounded-[10px] flex-1 min-w-0`}
      >
        <Card size="small" texture="canvas" className="plan-row-card">
          <div className={PLAN_ROWS_GRID_CLASS}>
            {idea.id ? <PlanIdStamp id={idea.id} /> : <span />}
            <span className={`${titleButtonClass} [cursor:inherit]`}>
              <NoteIcon />
              <span className={titleTextClass}>{idea.title}</span>
            </span>
            <span className="max-lg:hidden text-sm opacity-[0.45]">—</span>
            <span className="text-sm opacity-30">—</span>
            <Stamp
              size="small"
              fillColor={IDEA_STATUS_STAMP[status].fill}
              textColor={IDEA_STATUS_STAMP[status].text}
            >
              {IDEA_STATUS_LABEL[status]}
            </Stamp>
          </div>
        </Card>
      </div>
    </div>
  );
};

/** Fewer columns than a plan row (no updated/progress) and its own marker in the
 * title, since a fix is a distinct, minimal follow-up entity, not a nested child
 * of its (closed) parent — see IDEA-187. */
const FIX_ROW_GRID_CLASS =
  'grid grid-cols-[76px_minmax(0,1fr)_112px] gap-2.5 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

const FixRowCard = ({
  row,
  activePlanTitle,
  onOpen,
}: {
  row: FixRow;
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
}) => {
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
      <div
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen ? () => onOpen(fix.title) : undefined}
        onKeyDown={
          onOpen
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(fix.title);
                }
              }
            : undefined
        }
        className={`${onOpen ? 'cursor-pointer' : ''} rounded-[10px] flex-1 min-w-0 ${fix.title === activePlanTitle ? 'plan-row-highlighted outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]' : ''}`}
      >
        <Card size="small" texture="kraft" className="plan-row-card">
          <div className={FIX_ROW_GRID_CLASS}>
            <PlanIdStamp id={fix.id} />
            <span className={`${titleButtonClass} [cursor:inherit]`}>
              <Stamp size="small" variant="warning">
                fix
              </Stamp>
              <span className={titleTextClass}>{fix.title}</span>
              {fix.idea && (
                <span className="text-xs opacity-45 whitespace-nowrap font-mono">→ {fix.idea}</span>
              )}
            </span>
            <Stamp
              size="small"
              fillColor={STATUS_STAMP[status].fill}
              textColor={STATUS_STAMP[status].text}
            >
              {STATUS_LABEL[status]}
            </Stamp>
          </div>
        </Card>
      </div>
    </div>
  );
};
