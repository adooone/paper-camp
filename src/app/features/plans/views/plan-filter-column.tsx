import { selectPlanRows } from '@/app/features/plans/helpers';
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

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300 mb-2';

export const PlanFilterColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlan = useActivePlan();
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
  const setSubjectFilter = useAppStore((s) => s.setSubjectFilter);
  const navigate = useNavigate();

  if (!plans || activePlan) return null;

  const { statusCounts } = selectPlanRows(plans.entries, filters);
  const activeStatuses = new Set(filters.statuses);

  const linkClass =
    'bg-none bg-transparent border-none p-0 cursor-pointer opacity-70 underline text-2xs';

  const visibleStatuses = STATUS_CHIP_ORDER.filter(
    (status) => statusCounts[status] > 0 || activeStatuses.has(status),
  );

  return (
    <div className="flex flex-col gap-8 -mt-5">
      <Input
        type="search"
        size="small"
        placeholder="Search plans…"
        aria-label="Search plans"
        value={filters.search}
        onChange={(event) => setPlanSearch(event.target.value)}
      />

      {filters.subject !== null && (
        <div className="flex items-center gap-2" data-testid="subject-filter-chip">
          <span className="text-2xs opacity-70">Subject: {filters.subject}</span>
          <button
            type="button"
            onClick={() => {
              setSubjectFilter(null);
              navigate({ to: '/', search: {} });
            }}
            className={linkClass}
          >
            Clear
          </button>
        </div>
      )}

      <div>
        <div className={sectionLabelClass}>Status</div>
        <div className="flex flex-col gap-1">
          {visibleStatuses.map((status) => {
            const isActive = activeStatuses.has(status);
            return (
              <ListItem
                key={status}
                size="small"
                active={isActive}
                onClick={() => togglePlanStatus(status)}
                className="text-xs leading-4 py-2"
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
      </div>
    </div>
  );
};
