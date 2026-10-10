import { PageToolbar } from '@/app/components';
import { DEFAULT_PLAN_LIST_FILTERS, selectPlanRows } from '@/app/features/plans/helpers';
import { stripHorizonPrefix, useRoadmapSidebar } from '@/app/features/roadmap';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry, PlanStatus } from '@/types/index';
import { Button, Input, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import type { GroupMode } from '../helpers';
import { GroupByControl } from './group-by-control';

const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

const isDefaultStatuses = (statuses: PlanStatus[]): boolean =>
  statuses.length === DEFAULT_PLAN_LIST_FILTERS.statuses.length &&
  DEFAULT_PLAN_LIST_FILTERS.statuses.every((status) => statuses.includes(status));

interface PlansToolbarProps {
  entries: PlanEntry[];
  group: GroupMode;
  onGroupChange: (group: GroupMode) => void;
}

export const PlansToolbar = ({ entries, group, onGroupChange }: PlansToolbarProps) => {
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
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

  const { statusCounts } = selectPlanRows(entries, filters);
  const { statusCounts: corpusStatusCounts } = selectPlanRows(entries);
  const activeStatuses = new Set(filters.statuses);
  const visibleStatuses = STATUS_CHIP_ORDER.filter((status) => corpusStatusCounts[status] > 0);
  const hasPlanFilters =
    filters.search !== '' || filters.subject !== null || !isDefaultStatuses(filters.statuses);

  const hasActiveFilters = isHorizon ? hasHorizonFilters : hasPlanFilters;

  return (
    <PageToolbar>
      <Input
        type="search"
        size="small"
        placeholder={isHorizon ? 'Search roadmap…' : 'Search plans…'}
        aria-label={isHorizon ? 'Search roadmap' : 'Search plans'}
        value={isHorizon ? horizonFilters.search : filters.search}
        onChange={(event) =>
          isHorizon ? setRoadmapSearch(event.target.value) : setPlanSearch(event.target.value)
        }
        className="min-w-[200px] flex-[1_1_200px]"
      />

      {isHorizon
        ? horizonTitles.map((title) => (
            <Stamp
              key={title}
              size="small"
              variant="neutral"
              onClick={() => toggleRoadmapHorizon(title)}
              pressed={activeHorizons.has(title)}
            >
              {stripHorizonPrefix(title)} {horizonCounts[title] ?? 0}
            </Stamp>
          ))
        : visibleStatuses.map((status) => (
            <Stamp
              key={status}
              size="small"
              variant={STATUS_STAMP[status]}
              onClick={() => togglePlanStatus(status)}
              pressed={activeStatuses.has(status)}
            >
              {STATUS_LABEL[status]} {statusCounts[status]}
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
          className="text-2xs opacity-70"
        >
          Clear filters
        </Button>
      )}

      <GroupByControl group={group} onChange={onGroupChange} />
    </PageToolbar>
  );
};
