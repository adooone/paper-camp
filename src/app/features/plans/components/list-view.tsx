import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import { DEFAULT_PLAN_LIST_FILTERS, selectPlanRows } from '../plan-list-selector';
import { PlanCardSkeleton } from './plan-card-skeleton';
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

  useEffect(() => {
    if (!activePlanTitle) return;
    const row = containerRef.current?.querySelector('.plan-row-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePlanTitle]);

  const { rows } = selectPlanRows(plans, DEFAULT_PLAN_LIST_FILTERS);
  const showSkeleton = Boolean(draftingIdeaId) && !plans.some((p) => p.idea === draftingIdeaId);

  return (
    <div ref={containerRef}>
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
