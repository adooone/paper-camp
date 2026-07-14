import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useEffect } from 'react';
import { ReconcileDiffPanel } from '../modals';

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
  const { patch } = usePlanStatusPatch();

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
    // Keep the item queued so the user can retry rather than silently losing the
    // revert if the patch fails.
    const ok = await patch(
      plan.title,
      { body: head.before.body, phases: head.before.phases },
      { errorTitle: 'Discard failed' },
    );
    if (ok) removeFromReconcileQueue(head.planId);
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
