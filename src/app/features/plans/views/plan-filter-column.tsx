import { SidebarSkeleton } from '@/app/components';
import { SidebarField, SidebarLabel } from '@/app/components/sidebar';
import { DEFAULT_PLAN_LIST_FILTERS, selectPlanRows } from '@/app/features/plans/helpers';
import { useActivePlan } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanStatus } from '@/types/index';
import { Input, ListItem } from '@dendelion/paper-ui';
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

export const PlanFilterColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlan = useActivePlan();
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
  const clearPlanFilters = useAppStore((s) => s.clearPlanFilters);
  const navigate = useNavigate();

  if (activePlan) return null;
  if (!plans) return <SidebarSkeleton />;

  const { statusCounts } = selectPlanRows(plans.entries, filters);
  const { statusCounts: corpusStatusCounts } = selectPlanRows(plans.entries);
  const activeStatuses = new Set(filters.statuses);
  const visibleStatuses = STATUS_CHIP_ORDER.filter((status) => corpusStatusCounts[status] > 0);
  const hasActiveFilters =
    filters.search !== '' || filters.subject !== null || !isDefaultStatuses(filters.statuses);

  return (
    <div className="flex flex-col">
      <SidebarField label="Search">
        <Input
          type="search"
          size="small"
          placeholder="Search plans…"
          aria-label="Search plans"
          value={filters.search}
          onChange={(event) => setPlanSearch(event.target.value)}
        />
      </SidebarField>

      <SidebarLabel>Status</SidebarLabel>
      <div className="flex flex-col">
        {visibleStatuses.map((status) => {
          const isActive = activeStatuses.has(status);
          return (
            <ListItem
              key={status}
              size="small"
              active={isActive}
              onClick={() => togglePlanStatus(status)}
              className="pc-row text-xs"
              icon={
                <span
                  className="w-[9px] h-[9px] rounded-full shrink-0"
                  style={{ background: STATUS_STAMP[status].text }}
                />
              }
              action={<span className="text-2xs text-ink-500">{statusCounts[status]}</span>}
            >
              {STATUS_LABEL[status]}
            </ListItem>
          );
        })}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          data-testid="clear-plan-filters"
          onClick={() => {
            clearPlanFilters();
            navigate({ to: '/', search: {} });
          }}
          className="pc-row-label text-2xs opacity-70 underline text-left"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};
