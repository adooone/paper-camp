import { CheckboxFilterRow } from '@/app/components';
import { useAppStore } from '@/app/stores/app-store';
import { Button, SidebarCard, SidebarLabel } from '@dendelion/paper-ui';
import { STATUS_LABEL } from '../constants';
import { STATUS_FILTER_ORDER, isDefaultStatusFilter, selectPlanRows } from '../helpers';

export const StatusFilters = () => {
  const plans = useAppStore((s) => s.plans);
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const clearPlanStatusFilter = useAppStore((s) => s.clearPlanStatusFilter);

  if (!plans) return null;

  const { statusCounts } = selectPlanRows(plans.entries, filters);
  const activeStatuses = new Set(filters.statuses);
  const hasActiveFilters = !isDefaultStatusFilter(filters.statuses);

  return (
    <SidebarCard className="shrink-0">
      <div className="flex items-end justify-between gap-2">
        <SidebarLabel>Status</SidebarLabel>
        {hasActiveFilters && (
          <Button
            variant="link"
            onClick={clearPlanStatusFilter}
            className="pb-1 text-2xs opacity-70"
          >
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-col">
        {STATUS_FILTER_ORDER.map((status) => (
          <CheckboxFilterRow
            key={status}
            label={STATUS_LABEL[status]}
            checked={activeStatuses.has(status)}
            count={statusCounts[status]}
            ariaLabel={`${activeStatuses.has(status) ? 'Hide' : 'Show'} ${STATUS_LABEL[status]}`}
            onChange={() => togglePlanStatus(status)}
          />
        ))}
      </div>
    </SidebarCard>
  );
};
