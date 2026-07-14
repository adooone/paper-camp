import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Button, Card } from '@dendelion/paper-ui';
import { usePlanStatusPatch } from '../../use-plan-status-patch';
import { PlanIdStamp } from '../plan-id-stamp';

interface ReviewQueueProps {
  plans: PlanEntry[];
  onOpenPlan: (title: string) => void;
}

/**
 * The inline "needs review" queue (IDEA-39 phase 3): plans with `status:
 * review` get one-click Approve / Needs-changes here instead of a trip to
 * the old `/review` route (folded into this page by IDEA-40). Both actions
 * go through the same `usePlanStatusPatch` write path plan-actions-column.tsx
 * uses for its "Approve & close" action, rather than a second implementation
 * of the update/reload/toast dance. Approve promotes to `done`, which the
 * server archives on write; Needs-changes sends it back to `in-progress` so
 * the agent (or a human) can keep working it.
 */
export const ReviewQueue = ({ plans, onOpenPlan }: ReviewQueueProps) => {
  const { patch, updating } = usePlanStatusPatch();

  if (plans.length === 0) return null;

  return (
    <div style={{ marginBottom: space[5] }}>
      <h2 className="text-sm" style={{ margin: `0 0 ${space[2]}`, opacity: 0.6 }}>
        Needs review
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        {plans.map((plan) => (
          <Card key={plan.title} size="small" texture="canvas" className="plan-row-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                justifyContent: 'space-between',
              }}
            >
              {/* Raw <button>: makes the whole row clickable with no button chrome
                  of its own — a paper-ui Button would draw its own background. */}
              <button
                type="button"
                onClick={() => onOpenPlan(plan.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[2],
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <PlanIdStamp id={plan.id} />
                <span
                  style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {plan.title}
                </span>
              </button>
              <div style={{ display: 'flex', gap: space[2], flexShrink: 0 }}>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => patch(plan.title, { status: 'in-progress' })}
                  disabled={updating}
                >
                  Needs changes
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => patch(plan.title, { status: 'done' })}
                  disabled={updating}
                >
                  Approve
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
