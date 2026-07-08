import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { useToast } from '@dendelion/paper-ui';
import { useEffect } from 'react';
import { ReconcileDiffPanel } from './reconcile-diff-panel';

/**
 * Renders the reconcile review queue one entity at a time, from the Plans page
 * root — so reviewing a batch sweep's results never requires opening each
 * entity's own detail view. Fed by both a single Reconcile and a batch sweep,
 * which push onto the same `reconcileQueue` (see app-store.ts).
 */
export const ReconcileQueueReview = () => {
  const reconcileQueue = useAppStore((s) => s.reconcileQueue);
  const removeFromReconcileQueue = useAppStore((s) => s.removeFromReconcileQueue);
  const plans = useAppStore((s) => s.plans);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();

  const head = reconcileQueue[0] ?? null;
  const plan = head ? (plans?.entries.find((p) => p.id === head.planId) ?? null) : null;

  // A queued entity may have been deleted or renamed before its review came
  // up — drop it rather than getting stuck on an item that can no longer render.
  useEffect(() => {
    if (head && !plan) removeFromReconcileQueue(head.planId);
  }, [head, plan, removeFromReconcileQueue]);

  if (!head || !plan) return null;

  const handleApprove = () => {
    removeFromReconcileQueue(head.planId);
  };

  const handleDiscard = async () => {
    try {
      await updatePlan(plan.title, { body: head.before.body, phases: head.before.phases });
      await loadPlans();
      removeFromReconcileQueue(head.planId);
    } catch (err) {
      // Keep the item queued so the user can retry rather than silently losing the revert.
      toast({ title: 'Discard failed', description: (err as Error).message, variant: 'error' });
    }
  };

  return (
    <ReconcileDiffPanel
      plan={plan}
      before={head.before}
      onApprove={handleApprove}
      onDiscard={handleDiscard}
      queuePosition={{ index: 1, total: reconcileQueue.length }}
    />
  );
};
