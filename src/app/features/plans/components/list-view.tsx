import { space } from '@/app/styles/tokens';
import type { PlanEntry, PlanStatus } from '@/types/index';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PLAN_LIST_FILTERS,
  DEFAULT_VISIBLE_STATUSES,
  selectPlanRows,
} from '../plan-list-selector';
import { PlanCardSkeleton } from './plan-card-skeleton';
import { PlanFilterCard } from './plan-filter-card';
import { PlanRows } from './plan-rows';

interface ListViewProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onDeleteIdea?: (title: string) => void;
  draftingIdeaId?: string | null;
}

export const ListView = ({
  plans,
  activePlanTitle,
  onOpenPlan,
  onDeleteIdea,
  draftingIdeaId,
}: ListViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [statuses, setStatuses] = useState<PlanStatus[]>(DEFAULT_VISIBLE_STATUSES);

  useEffect(() => {
    if (!activePlanTitle) return;
    const row = containerRef.current?.querySelector('.plan-row-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePlanTitle]);

  const toggleStatus = (status: PlanStatus) => {
    setStatuses((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status],
    );
  };

  const { rows, statusCounts } = selectPlanRows(plans, { ...DEFAULT_PLAN_LIST_FILTERS, statuses });
  const showSkeleton = Boolean(draftingIdeaId) && !plans.some((p) => p.idea === draftingIdeaId);

  return (
    <div ref={containerRef}>
      <PlanFilterCard
        statusCounts={statusCounts}
        activeStatuses={statuses}
        onToggleStatus={toggleStatus}
      />
      {showSkeleton && draftingIdeaId && (
        <div style={{ marginBottom: space[3] }}>
          <PlanCardSkeleton ideaId={draftingIdeaId} />
        </div>
      )}
      {rows.length > 0 && (
        <PlanRows
          plans={rows}
          activePlanTitle={activePlanTitle}
          onOpen={onOpenPlan}
          onDeleteIdea={onDeleteIdea}
        />
      )}
    </div>
  );
};
