import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { PlanCard } from './plan-card';

interface StatusPlanListProps {
  plans: PlanEntry[];
  emptyMessage: string;
  onOpenPlan: (title: string) => void;
}

/** A flat PlanCard list for the Review/Closed tabs — no idea grouping, unlike ListView's worklist tree. */
export const StatusPlanList = ({ plans, emptyMessage, onOpenPlan }: StatusPlanListProps) => {
  if (plans.length === 0) {
    return <p style={{ opacity: 0.5 }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
      {plans.map((p) => (
        <PlanCard key={p.title} plan={p} onOpen={onOpenPlan} />
      ))}
    </div>
  );
};
