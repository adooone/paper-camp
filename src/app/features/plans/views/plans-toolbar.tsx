import { PageToolbar, PageToolbarRow } from '@/app/components';
import { isDefaultStatusFilter } from '@/app/features/plans/helpers';
import { stripHorizonPrefix, useRoadmapSidebar } from '@/app/features/roadmap';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Input, Stamp } from '@dendelion/paper-ui';
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

  const {
    horizonTitles,
    horizonCounts,
    activeHorizons,
    hasActiveFilters: hasHorizonFilters,
    toggleRoadmapHorizon,
    filters: horizonFilters,
    setRoadmapSearch,
    clearRoadmapFilters,
  } = useRoadmapSidebar();

  const isHorizon = group === 'horizon';

  const hasPlanFilters =
    filters.search !== '' || filters.subject !== null || !isDefaultStatusFilter(filters.statuses);

  const hasActiveFilters = isHorizon ? hasHorizonFilters : hasPlanFilters;

  return (
    <PageToolbar>
      <PageToolbarRow>
        <Input
          type="search"
          size="small"
          placeholder={isHorizon ? 'Search roadmap…' : 'Search ideas…'}
          aria-label={isHorizon ? 'Search roadmap' : 'Search ideas'}
          value={isHorizon ? horizonFilters.search : filters.search}
          onChange={(event) =>
            isHorizon ? setRoadmapSearch(event.target.value) : setPlanSearch(event.target.value)
          }
          className="min-w-[140px] flex-1"
        />
        <GroupSelect group={group} onChange={onGroupChange} showProject={multiProject} />
      </PageToolbarRow>

      {(isHorizon || hasActiveFilters) && (
        <PageToolbarRow chips>
          {isHorizon &&
            horizonTitles.map((title) => (
              <Stamp
                key={title}
                size="small"
                variant="neutral"
                onClick={() => toggleRoadmapHorizon(title)}
                pressed={activeHorizons.has(title)}
              >
                {stripHorizonPrefix(title)} {horizonCounts[title] ?? 0}
              </Stamp>
            ))}

          {hasActiveFilters && (
            <Button
              variant="link"
              data-testid="clear-plan-filters"
              onClick={() => {
                if (isHorizon) clearRoadmapFilters();
                else clearPlanFilters();
                navigate({ to: '/', search: { group } });
              }}
              className="ml-auto text-2xs opacity-70"
            >
              Clear filters
            </Button>
          )}
        </PageToolbarRow>
      )}
    </PageToolbar>
  );
};
