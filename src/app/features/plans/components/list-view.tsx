import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import { PlanCardSkeleton } from './plan-card-skeleton';
import { PlanRows } from './plan-rows';

interface ListViewProps {
  plans: PlanEntry[];
  rows: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onDeleteIdea?: (title: string) => void;
  draftingIdeaId?: string | null;
}

export const ListView = ({
  plans,
  rows,
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

  const showSkeleton = Boolean(draftingIdeaId) && !plans.some((p) => p.idea === draftingIdeaId);

  return (
    <div ref={containerRef}>
      {showSkeleton && draftingIdeaId && (
        <div style={{ marginBottom: space[3] }}>
          <PlanCardSkeleton ideaId={draftingIdeaId} />
        </div>
      )}
      {rows.length > 0 ? (
        <PlanRows
          plans={rows}
          activePlanTitle={activePlanTitle}
          onOpen={onOpenPlan}
          onDeleteIdea={onDeleteIdea}
        />
      ) : (
        // Plans exist but the active filters/search matched none. Without this the
        // list renders blank — PlansPage only handles the "no plans at all" case.
        // Show an explicit empty state instead (docs/UX_PRINCIPLES.md).
        !showSkeleton && (
          <p style={{ opacity: 0.5, padding: `${space[6]} 0`, textAlign: 'center' }}>
            No plans match your filters.
          </p>
        )
      )}
    </div>
  );
};
