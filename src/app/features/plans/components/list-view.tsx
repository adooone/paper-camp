import type { PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import { ClosedSection } from './closed-section';
import { IdeaCard } from './idea-card';
import { PlanCard } from './plan-card';
import { SectionHeading } from './section-heading';

interface IdeaEntry {
  title: string;
  body: string;
}

interface ListViewProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  ideaEntries?: IdeaEntry[];
  onOpenIdea?: (title: string) => void;
}

export const ListView = ({
  plans,
  activePlanTitle,
  onOpenPlan,
  ideaEntries,
  onOpenIdea,
}: ListViewProps) => {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activePlanTitle && cardRefs.current[activePlanTitle]) {
      cardRefs.current[activePlanTitle]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activePlanTitle]);

  const active = plans.filter((p) => p.status === 'in-progress');
  const backlog = plans.filter((p) => p.status === 'planned' || p.status === 'idea');
  const closed = plans.filter((p) => p.status === 'done' || p.status === 'dropped');

  const wrapRef = (title: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[title] = el;
  };

  return (
    <div>
      {active.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeading label="In progress" count={active.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {active.map((p) => (
              <div key={p.title} ref={wrapRef(p.title)}>
                <PlanCard plan={p} highlighted={activePlanTitle === p.title} onOpen={onOpenPlan} />
              </div>
            ))}
          </div>
        </section>
      )}

      {backlog.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeading label="Backlog" count={backlog.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {backlog.map((p) => (
              <div key={p.title} ref={wrapRef(p.title)}>
                <PlanCard plan={p} highlighted={activePlanTitle === p.title} onOpen={onOpenPlan} />
              </div>
            ))}
          </div>
        </section>
      )}

      {ideaEntries && ideaEntries.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeading label="Ideas" count={ideaEntries.length} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {ideaEntries.map((e) => (
              <IdeaCard key={e.title} title={e.title} onClick={() => onOpenIdea?.(e.title)} />
            ))}
          </div>
        </section>
      )}

      <ClosedSection plans={closed} />
    </div>
  );
};
