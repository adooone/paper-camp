import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, space } from '@/app/styles/tokens';
import { IconButton, Select } from '@dendelion/paper-ui';
import type { PlanSortKey } from '../plan-list-selector';
import { ActualiseAllButton } from './actualise-all-button';
import { AddToBacklogButton } from './add-to-backlog-button';
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
 * actualise-all), rendered above the worklist.
 */
export const PlansHeader = () => {
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

      <div
        style={{
          display: 'flex',
          gap: space[2],
          alignItems: 'center',
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
      <ActualiseAllButton />
    </div>
  );
};
