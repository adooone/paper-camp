import { PageToolbar } from '@/app/components';
import { DEFAULT_PLAN_LIST_FILTERS, selectPlanRows } from '@/app/features/plans/helpers';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry, PlanStatus } from '@/types/index';
import { Button, Input, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

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
}

export const PlansToolbar = ({ entries }: PlansToolbarProps) => {
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
  const clearPlanFilters = useAppStore((s) => s.clearPlanFilters);
  const navigate = useNavigate();

  const { statusCounts } = selectPlanRows(entries, filters);
  const { statusCounts: corpusStatusCounts } = selectPlanRows(entries);
  const activeStatuses = new Set(filters.statuses);
  const visibleStatuses = STATUS_CHIP_ORDER.filter((status) => corpusStatusCounts[status] > 0);
  const hasActiveFilters =
    filters.search !== '' || filters.subject !== null || !isDefaultStatuses(filters.statuses);

  return (
    <PageToolbar>
      <Input
        type="search"
        size="small"
        placeholder="Search plans…"
        aria-label="Search plans"
        value={filters.search}
        onChange={(event) => setPlanSearch(event.target.value)}
        className="min-w-[200px] flex-[1_1_200px]"
      />

      {visibleStatuses.map((status) => {
        const isActive = activeStatuses.has(status);
        return (
          <Stamp
            key={status}
            size="small"
            variant={STATUS_STAMP[status]}
            onClick={() => togglePlanStatus(status)}
            pressed={isActive}
          >
            {STATUS_LABEL[status]} {statusCounts[status]}
          </Stamp>
        );
      })}

      {hasActiveFilters && (
        <Button
          variant="link"
          data-testid="clear-plan-filters"
          onClick={() => {
            clearPlanFilters();
            navigate({ to: '/', search: {} });
          }}
          className="text-2xs opacity-70"
        >
          Clear filters
        </Button>
      )}
    </PageToolbar>
  );
};
