import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, space } from '@/app/styles/tokens';
import { IconButton, Select } from '@dendelion/paper-ui';
import type { PlanSortKey } from '../plan-list-selector';
import { AddToBacklogButton } from './add-to-backlog-button';
import { AuditAllButton } from './audit-all-button';
import { NewIdeaButton } from './new-idea-button';

const SORT_OPTIONS: { value: PlanSortKey; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'updated', label: 'Updated' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'id', label: 'ID' },
  { value: 'progress', label: 'Phase progress' },
];

/**
 * The plans page header row: the page title plus the toolbar (sort, add-to-backlog,
 * audit-all, view toggle), rendered above the list/board. Sort only applies to the
 * list, so it's hidden in board view; the rest stays so the view toggle is reachable.
 */
export const PlansHeader = () => {
  const view = useAppStore((s) => s.view);
  const filters = useAppStore((s) => s.planFilters);
  const setPlanSortKey = useAppStore((s) => s.setPlanSortKey);
  const togglePlanSortDirection = useAppStore((s) => s.togglePlanSortDirection);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        marginBottom: space[6],
      }}
    >
      <h1
        className="text-4xl"
        style={{
          flex: 1,
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          color: color.textPrimary,
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        Plans
      </h1>

      {/* Sort applies to the list only, but we keep it mounted and just hide it in
          board view (visibility, not conditional mount) so the toolbar buttons to
          its right don't jump when toggling views — per docs/UX_PRINCIPLES.md
          "reserve space for content that changes". visibility:hidden also drops it
          from tab order and the a11y tree while hidden. */}
      <div
        style={{
          display: 'flex',
          gap: space[2],
          alignItems: 'center',
          visibility: view === 'list' ? 'visible' : 'hidden',
        }}
      >
        <Select
          size="small"
          options={SORT_OPTIONS}
          value={filters.sortKey}
          onChange={(value) => setPlanSortKey(value as PlanSortKey)}
        />
        <IconButton
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: filters.sortDirection === 'desc' ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.15s ease',
              }}
            >
              <title>Sort direction</title>
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          }
          label={filters.sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
          size="small"
          variant="ghost"
          onClick={togglePlanSortDirection}
        />
      </div>

      <NewIdeaButton />
      <AddToBacklogButton />
      <AuditAllButton />
    </div>
  );
};
