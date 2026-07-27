import { splitReview } from '@/app/services/agent-api';
import { createIdea } from '@/app/services/content';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PhaseItem, PlanEntry, ReviewSplitResult } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { usePlanStatusPatch } from '../hooks/use-plan-status-patch';
import { ReviewSplitPreviewPanel } from '../modals';

interface SplitReviewButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const SplitReviewButton = ({ plan, disabled }: SplitReviewButtonProps) => {
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
  const { patch } = usePlanStatusPatch();
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<ReviewSplitResult | null>(null);

  const points = plan.review ?? [];

  const handleClick = async () => {
    if (!plan.id || points.length === 0) return;
    setLaunching(true);
    try {
      setResult(await splitReview(plan.id));
    } catch (err) {
      toast({
        title: 'Could not split the review',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setLaunching(false);
    }
  };

  // Mints follow-up ideas before touching the plan: if idea creation fails partway,
  // the review points are left untouched so the whole approval can just be retried.
  const handleApprove = async () => {
    if (!result) return;
    try {
      const followUps = result.items.flatMap((item) =>
        item.kind === 'idea' && item.followUp ? [item.followUp] : [],
      );
      await Promise.all(followUps.map((f) => createIdea({ title: f.title, content: f.body })));

      const newPhases: PhaseItem[] = result.items
        .flatMap((item) => (item.kind === 'rework' ? (item.phases ?? []) : []))
        .map((phase) => ({
          done: false,
          text: phase.text,
          description: phase.description,
          source: 'review',
        }));
      const ok = await patch(plan.title, {
        review: [],
        ...(newPhases.length > 0 && { phases: [...plan.phases, ...newPhases] }),
      });
      if (!ok) return;
      setResult(null);
    } catch (err) {
      toast({
        title: 'Could not apply the split',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const hint = !plan.id
    ? 'Needs an ID before an agent can run'
    : points.length === 0
      ? 'Add a review point first — this proposes rework phases or a follow-up idea for each'
      : !hasAgent
        ? 'No agent CLI found — set up in Settings'
        : 'Split each review point into rework or a follow-up idea';

  return (
    <>
      <Tooltip content={hint}>
        <Button
          variant="secondary"
          size="small"
          onClick={handleClick}
          disabled={disabled || launching || !plan.id || !hasAgent || points.length === 0}
        >
          {launching ? 'Splitting…' : 'Split review'}
        </Button>
      </Tooltip>
      {result && (
        <ReviewSplitPreviewPanel
          plan={plan}
          result={result}
          onApprove={handleApprove}
          onDiscard={async () => setResult(null)}
        />
      )}
    </>
  );
};
