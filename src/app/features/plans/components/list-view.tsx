import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { useEffect, useRef } from 'react';
import type { WorklistRow } from '../plan-list-selector';
import { WorklistRows } from './worklist-rows';

interface ListViewProps {
  plans: PlanEntry[];
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
  onDeleteIdea?: (title: string) => void;
}

export const ListView = ({
  plans,
  rows,
  activePlanTitle,
  onOpenPlan,
  onOpenIdea,
  onDeleteIdea,
}: ListViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePlanTitle) return;
    const row = containerRef.current?.querySelector('.plan-row-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePlanTitle]);

  return (
    <div ref={containerRef}>
      {rows.length > 0 ? (
        <WorklistRows
          rows={rows}
          plans={plans}
          activePlanTitle={activePlanTitle}
          onOpenPlan={onOpenPlan}
          onOpenIdea={onOpenIdea}
          onDeleteIdea={onDeleteIdea}
        />
      ) : (
        // Plans exist but the active filters/search matched none. Without this the
        // list renders blank — PlansPage only handles the "no plans at all" case.
        // Show an explicit empty state instead (docs/UX_PRINCIPLES.md).
        <p style={{ opacity: 0.5, padding: `${space[6]} 0`, textAlign: 'center' }}>
          No plans match your filters.
        </p>
      )}
    </div>
  );
};
