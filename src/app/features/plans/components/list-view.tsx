import { space } from '@/app/styles/tokens';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import { ClosedSection } from './closed-section';
import { IdeasBoard } from './ideas-board';
import { PlanCard } from './plan-card';
import { PlanCardSkeleton } from './plan-card-skeleton';
import { SectionHeading } from './section-heading';

interface ListViewProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  ideaEntries?: IdeaEntry[];
  onOpenIdea?: (title: string) => void;
  draftingIdeaId?: string | null;
}

export const ListView = ({
  plans,
  activePlanTitle,
  onOpenPlan,
  ideaEntries,
  onOpenIdea,
  draftingIdeaId,
}: ListViewProps) => {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activePlanTitle && cardRefs.current[activePlanTitle]) {
      cardRefs.current[activePlanTitle]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activePlanTitle]);

  const active = plans.filter((p) => p.status === 'in-progress' || p.status === 'review');
  const backlog = plans.filter((p) => p.status === 'planned' || p.status === 'idea');
  const closed = plans.filter((p) => p.status === 'done' || p.status === 'dropped');

  const showSkeleton = Boolean(draftingIdeaId) && !plans.some((p) => p.idea === draftingIdeaId);

  const wrapRef = (title: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[title] = el;
  };

  return (
    <div>
      {active.length > 0 && (
        <section style={{ marginBottom: space[8] }}>
          <SectionHeading label="In progress" count={active.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
            {active.map((p) => (
              <div key={p.title} ref={wrapRef(p.title)}>
                <PlanCard plan={p} highlighted={activePlanTitle === p.title} onOpen={onOpenPlan} />
              </div>
            ))}
          </div>
        </section>
      )}

      {(backlog.length > 0 || showSkeleton) && (
        <section style={{ marginBottom: space[8] }}>
          <SectionHeading label="Backlog" count={backlog.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
            {showSkeleton && draftingIdeaId && <PlanCardSkeleton ideaId={draftingIdeaId} />}
            {backlog.map((p, i) => (
              <div key={p.title} ref={wrapRef(p.title)}>
                <PlanCard
                  plan={p}
                  highlighted={activePlanTitle === p.title}
                  onOpen={onOpenPlan}
                  rank={i + 1}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {ideaEntries && ideaEntries.length > 0 && (
        <section style={{ marginBottom: space[8] }}>
          <SectionHeading label="Ideas" count={ideaEntries.length} />
          <IdeasBoard
            ideas={ideaEntries}
            plans={plans}
            onOpenIdea={onOpenIdea}
            onOpenPlan={onOpenPlan}
          />
        </section>
      )}

      <ClosedSection plans={closed} onOpen={onOpenPlan} />
    </div>
  );
};
