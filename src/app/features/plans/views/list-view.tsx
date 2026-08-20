import type { WorklistRow } from '@/app/features/plans/helpers';
import { useEffect, useRef } from 'react';
import { WorklistRows } from './worklist-rows';

interface ListViewProps {
  rows: WorklistRow[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
}

export const ListView = ({ rows, activePlanTitle, onOpenPlan, onOpenIdea }: ListViewProps) => {
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
          activePlanTitle={activePlanTitle}
          onOpenPlan={onOpenPlan}
          onOpenIdea={onOpenIdea}
        />
      ) : (
        // PlansPage only handles the "no plans at all" case; this covers filters matching none.
        <p className="opacity-50 py-6 px-0 text-center">
          Nothing matches these filters — clear one, or check back once something moves into this
          status.
        </p>
      )}
    </div>
  );
};
