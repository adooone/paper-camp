import { splitReview } from '@/app/services/agent-api';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry, ReviewSplitResult } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { ReviewSplitPreviewPanel } from '../modals';

interface SplitReviewButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const SplitReviewButton = ({ plan, disabled }: SplitReviewButtonProps) => {
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
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
          onApprove={async () => setResult(null)}
          onDiscard={async () => setResult(null)}
        />
      )}
    </>
  );
};
