import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import { ClosedSection } from './closed-section';
import { PlanCardSkeleton } from './plan-card-skeleton';
import { PlanRows } from './plan-rows';
import { SectionHeading } from './section-heading';

interface ListViewProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  draftingIdeaId?: string | null;
}

export const ListView = ({ plans, activePlanTitle, onOpenPlan, draftingIdeaId }: ListViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePlanTitle) return;
    const row = containerRef.current?.querySelector('.plan-row-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePlanTitle]);

  const active = plans.filter((p) => p.status === 'in-progress' || p.status === 'review');
  const backlog = plans.filter((p) => p.status === 'planned' || p.status === 'idea');
  const closed = plans.filter((p) => p.status === 'done' || p.status === 'dropped');

  const showSkeleton = Boolean(draftingIdeaId) && !plans.some((p) => p.idea === draftingIdeaId);

  return (
    <div ref={containerRef}>
      {active.length > 0 && (
        <section style={{ marginBottom: space[8] }}>
          <SectionHeading label="In progress" count={active.length} />
          <PlanRows plans={active} activePlanTitle={activePlanTitle} onOpen={onOpenPlan} />
        </section>
      )}

      {(backlog.length > 0 || showSkeleton) && (
        <section style={{ marginBottom: space[8] }}>
          <SectionHeading label="Backlog" count={backlog.length} />
          {showSkeleton && draftingIdeaId && (
            <div style={{ marginBottom: space[3] }}>
              <PlanCardSkeleton ideaId={draftingIdeaId} />
            </div>
          )}
          {backlog.length > 0 && (
            <PlanRows plans={backlog} activePlanTitle={activePlanTitle} onOpen={onOpenPlan} />
          )}
        </section>
      )}

      <ClosedSection plans={closed} activePlanTitle={activePlanTitle} onOpen={onOpenPlan} />
    </div>
  );
};
