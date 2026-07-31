import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';
import { ReconcileDiffPanel } from '../modals';

export const ReconcileQueueReview = () => {
  const reconcileQueue = useAppStore((s) => s.reconcileQueue);
  const removeFromReconcileQueue = useAppStore((s) => s.removeFromReconcileQueue);
  const plans = useAppStore((s) => s.plans);
  const { patch } = usePlanStatusPatch();
  const { toast } = useToast();
  // Counts dismissed previews so the header reads "2 of 3" — the queue only knows what's pending.
  const reviewedCount = useRef(0);

  const head = reconcileQueue[0] ?? null;
  const plan = head ? (plans?.entries.find((p) => p.id === head.planId) ?? null) : null;

  // Drop a queued entity that was deleted or renamed rather than getting stuck.
  useEffect(() => {
    if (head && !plan) removeFromReconcileQueue(head.previewId);
  }, [head, plan, removeFromReconcileQueue]);

  useEffect(() => {
    if (reconcileQueue.length === 0) reviewedCount.current = 0;
  }, [reconcileQueue.length]);

  if (!head || !plan) return null;

  const handleApprove = async () => {
    // The agent already wrote body/phases to disk, so approve has nothing left to do.
    removeFromReconcileQueue(head.previewId);
    reviewedCount.current += 1;
    toast({
      title: 'Kept the merged version',
      description: `"${plan.title}" keeps the agent's rewrite.`,
    });
  };

  const handleDiscard = async () => {
    // Keep the item queued so the user can retry rather than silently losing the
    // revert if the patch fails.
    const ok = await patch(
      plan.title,
      { body: head.before.body, phases: head.before.phases },
      { errorTitle: 'Discard failed' },
    );
    if (ok) {
      removeFromReconcileQueue(head.previewId);
      reviewedCount.current += 1;
    }
  };

  return (
    <ReconcileDiffPanel
      plan={plan}
      before={head.before}
      onApprove={handleApprove}
      onDiscard={handleDiscard}
      queuePosition={{
        index: reviewedCount.current + 1,
        total: reviewedCount.current + reconcileQueue.length,
      }}
    />
  );
};
