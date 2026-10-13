import { PageToolbar, PageToolbarRow } from '@/app/components';
import { isDefaultStatusFilter } from '@/app/features/plans/helpers';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Input } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import type { GroupMode } from '../helpers';
import { GroupSelect } from './group-select';

interface PlansToolbarProps {
  group: GroupMode;
  onGroupChange: (group: GroupMode) => void;
  multiProject: boolean;
}

export const PlansToolbar = ({ group, onGroupChange, multiProject }: PlansToolbarProps) => {
  const filters = useAppStore((s) => s.planFilters);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
  const clearPlanFilters = useAppStore((s) => s.clearPlanFilters);
  const navigate = useNavigate();

  const hasActiveFilters =
    filters.search !== '' || filters.subject !== null || !isDefaultStatusFilter(filters.statuses);

  return (
    <PageToolbar>
      <PageToolbarRow>
        <Input
          type="search"
          size="small"
          placeholder="Search ideas…"
          aria-label="Search ideas"
          value={filters.search}
          onChange={(event) => setPlanSearch(event.target.value)}
          className="w-[240px] min-w-[140px] shrink"
        />
        {hasActiveFilters && (
          <Button
            variant="link"
            data-testid="clear-plan-filters"
            onClick={() => {
              clearPlanFilters();
              navigate({ to: '/', search: { group } });
            }}
            className="shrink-0 text-2xs opacity-70"
          >
            Clear filters
          </Button>
        )}
        <span className="flex-1" />
        <GroupSelect group={group} onChange={onGroupChange} showProject={multiProject} />
      </PageToolbarRow>
    </PageToolbar>
  );
};
