import type { ScopeRow } from '@/app/features/scope';
import type { LogSort } from '@/core/run-filters';
import { Button, ChevronRightIcon, Row } from '@dendelion/folk-ui';
import type { ScopedActivityEntry } from '../helpers';
import { LOG_ROW_GRID_CLASS, LogRowView, WIDE_ONLY_CLASS } from './run-row';

const headerLabelClass = 'text-xs whitespace-nowrap';

const SORT_ARIA: Record<LogSort, string> = {
  time: 'Sort by time',
  duration: 'Sort by duration',
  cost: 'Sort by cost',
};

const SortLabel = ({
  sortKey,
  label,
  active,
  onSort,
  className = '',
}: {
  sortKey: LogSort;
  label: string;
  active: boolean;
  onSort: (sort: LogSort) => void;
  className?: string;
}) => (
  // biome-ignore lint/a11y/useSemanticElements: a CSS-grid cell, not a <table>; a real <th> would need a <tr>/<table> ancestor.
  <span role="columnheader" aria-sort={active ? 'descending' : undefined} className={className}>
    <button
      type="button"
      aria-label={SORT_ARIA[sortKey]}
      onClick={() => onSort(sortKey)}
      className={`${headerLabelClass} flex items-center gap-1 border-none bg-transparent p-0 text-inherit ${active ? 'font-semibold' : 'opacity-60'}`}
    >
      {label}
      {active && (
        <span className="flex rotate-90">
          <ChevronRightIcon size={12} />
        </span>
      )}
    </button>
  </span>
);

const Label = ({ children, className = '' }: { children: string; className?: string }) => (
  <span className={`${headerLabelClass} opacity-60 ${className}`}>{children}</span>
);

/** Shares the run rows' grid, so every label sits over its column. Sorting is
 *  newest, longest or costliest first — the `sort` param has no direction. */
const ActivityListHeader = ({
  sort,
  onSort,
}: {
  sort: LogSort;
  onSort: (sort: LogSort) => void;
}) => (
  <Row
    surface="card"
    texture="kraft"
    columns={{ title: 'minmax(0,1fr)' }}
    className="h-8 max-[480px]:hidden"
    title={
      <div className={LOG_ROW_GRID_CLASS}>
        <SortLabel sortKey="time" label="Time" active={sort === 'time'} onSort={onSort} />
        <Label>Type</Label>
        <Label>Title</Label>
        <Label className={WIDE_ONLY_CLASS}>Agent</Label>
        <SortLabel sortKey="duration" label="Took" active={sort === 'duration'} onSort={onSort} />
        <SortLabel
          sortKey="cost"
          label="Cost"
          active={sort === 'cost'}
          onSort={onSort}
          className={WIDE_ONLY_CLASS}
        />
        <Label className="justify-self-end">Outcome</Label>
      </div>
    }
  />
);

export interface ActivityStreamProps {
  sort: LogSort;
  onSort: (sort: LogSort) => void;
  entries: ScopedActivityEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
}

export const ActivityStream = ({
  sort,
  onSort,
  entries,
  hasMore,
  onLoadMore,
  onOpenCrossProject,
}: ActivityStreamProps) => (
  <div className="flex flex-col gap-1">
    <ActivityListHeader sort={sort} onSort={onSort} />
    {entries.map(({ row, project }) => (
      <LogRowView
        key={row.id}
        row={row}
        project={project}
        onOpenCrossProject={onOpenCrossProject}
      />
    ))}
    {hasMore && (
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="small" onClick={onLoadMore}>
          Load more
        </Button>
      </div>
    )}
  </div>
);
